var _ = require('lodash');
var translate = require("./translate");
var linkify = require('linkifyjs');

/**
 * optional environment variables - These are not used defined during setup of this function in QnABot but are
 * useful for testing if defined.
 *
 * REGION - optional AWS region to target
 * KENDRA_INDEX - optional string defining index to query
 *
 */

const AWS = require('aws-sdk');
let kendraIndexes = undefined;


/**
 * Function to bold highlights in Kendra answer by adding markdown
 * @param {string} textIn
 * @param {number} hlBeginOffset
 * @param {number} hlEndOffset
 * @param {boolean} highlightOnly
 * @returns {string}
 */
function addMarkdownHighlights(textIn,hlBeginOffset,hlEndOffset,highlightOnly=false) {
    let beginning = textIn.substring(0, hlBeginOffset);
    let highlight = textIn.substring(hlBeginOffset, hlEndOffset);
    let rest = textIn.substr(hlEndOffset);
    let textOut = textIn; //default
    // add markdown only if highlight is not in the middle of a url/link.. 
    if (! isHighlightInLink(textIn,hlBeginOffset)) {
        if (highlightOnly) {
            textOut = '**' + highlight + '**';
        } else {
            textOut = beginning + '**' + highlight + '**' + rest;
        }        
    }
    return textOut ;
}

function isHighlightInLink(textIn,hlBeginOffset) {
    let links = linkify.find(textIn) ;
    for (let l=0; l<links.length; l++) {
        let linkText=links[l].value ;
        let linkBeginOffset = textIn.indexOf(linkText) ;
        let linkEndOffset = linkBeginOffset + linkText.length ;
        if (hlBeginOffset >= linkBeginOffset && hlBeginOffset <= linkEndOffset) {
            return true;
        }
    }
    return false;
}

/**
 * Function to query kendraClient and return results via Promise
 * @param kendraClient
 * @param params
 * @param resArray
 * @returns {*}
 */
function kendraRequester(kendraClient,params,resArray) {
    return new Promise(function(resolve, reject) {
        kendraClient.query(params, function(err, data) {
            let indexId = params.IndexId;
            if (err) {
                console.log(err, err.stack);
                reject('Error from Kendra query request:' + err);
            }
            else {
                data.originalKendraIndexId = indexId;
                console.log("Data from Kendra request:" + JSON.stringify(data, null, 2));
                resArray.push(data);
                resolve(data);
            }
        });
    });
}



/**
 * Function to sort and merge overlapping intervals
 * @param intervals
 * @returns [*]
 * Source: https://gist.github.com/vrachieru/5649bce26004d8a4682b
 */
function mergeIntervals(intervals) {
  // test if there are at least 2 intervals
  if(intervals.length <= 1)
    return intervals;

  var stack = [];
  var top   = null;

  // sort the intervals based on their start values
  intervals.sort(function(a, b) {return a[0] - b[0]});

  // push the 1st interval into the stack
  stack.push(intervals[0]);

  // start from the next interval and merge if needed
  for (var i = 1; i < intervals.length; i++) {
    // get the top element
    top = stack[stack.length - 1];

    // if the current interval doesn't overlap with the 
    // stack top element, push it to the stack
    if (top.EndOffset < intervals[i].BeginOffset) {
      stack.push(intervals[i]);
    }
    // otherwise update the end value of the top element
    // if end of current interval is higher
    else if (top.EndOffset < intervals[i].EndOffset)
    {
      top.EndOffset = intervals[i].EndOffset;
      stack.pop();
      stack.push(top);
    }
  }

  return stack;
}


function signS3URL(url, expireSecs) {
    var bucket, key; 
    if (url.search(/\/s3[.-](\w{2}-\w{4,9}-\d\.)?amazonaws\.com/) != -1) {
      //bucket in path format
      bucket = url.split('/')[3];
      key = url.split('/').slice(4).join('/');
    }
    if (url.search(/\.s3[.-](\w{2}-\w{4,9}-\d\.)?amazonaws\.com/) != -1) {
      //bucket in hostname format
      let hostname = url.split("/")[2];
      bucket = hostname.split(".")[0];
      key = url.split('/').slice(3).join('/');
    }
    if (bucket && key) {
        console.log("Attempt to convert S3 url to a signed URL: ",url);
        console.log("Bucket: ", bucket, " Key: ", key) ;
        try {
            const s3 = new AWS.S3() ;
            const signedurl = s3.getSignedUrl('getObject', {
                Bucket: bucket,
                Key: key,
                Expires: expireSecs
            })
            console.log("Signed URL: ", signedurl);
            url = signedurl;
        } catch (err) {
              console.log("Error signing S3 URL (returning original URL): ", err) ;
        }
    } else {
        console.log("URL is not an S3 url - return unchanged: ",url);
    }   
    return url;
}

// get document name from URL
// last element of path with any params removed
function docName(uri) {
  if (uri.DocumentTitle) {
    return uri.Title;
  }
  if (uri.Uri) {
    uri = uri.Uri;
  }
  let x = uri.split("/");
  let y = x[x.length - 1];
  let n = y.split("?")[0];
  return n;
}

/**
 * Function to return the longest interval from a list of sorted intervals
 * @param intervals
 * @returns {*}
 */
function longestInterval(intervals) {
  // test if there are at least 2 intervals
  if (intervals.length == 0) {
      return intervals;
  } else if (intervals.length == 1) {
    return intervals[0];
  }
  
  // sort the intervals based on their length
  intervals.sort(function(a, b) {return (a[1]-a[0]) - (b[1]-b[0])});
  return intervals[0];

}


/** Function that processes kendra requests and handles response. Decides whether to handle SNS
 * events or Lambda Hook events from QnABot.
 * @param event - input event passed to the Lambda Handler
 * @param context - input context passed to the Lambda Handler
 * @returns {Promise<*>} - returns the response in event.res
 */
async function routeKendraRequest(event, context) {

    // remove any prior session attributes for kendra
    _.unset(event,"res.session.qnabotcontext.kendra.kendraQueryId") ;
    _.unset(event,"res.session.qnabotcontext.kendra.kendraIndexId") ;
    _.unset(event,"res.session.qnabotcontext.kendra.kendraResultId") ;
    _.unset(event,"res.session.qnabotcontext.kendra.kendraResponsibleQid") ;

    let promises = [];
    let resArray = [];
    let kendraClient = undefined;
    
    // if test environment, then use mock-up of kendraClient
    if (event.test) {
        var mockup = './test/mockClient' + event.test + '.js';
        kendraClient = require(mockup);
    } else {
        AWS.config.update({
          maxRetries: _.get(event.req["_settings"], "KENDRAFAQ_CONFIG_MAX_RETRIES"),
          retryDelayOptions: {
            base: _.get(event.req["_settings"], "KENDRAFAQ_CONFIG_RETRY_DELAY")
          },
        });
        kendraClient = (process.env.REGION ?
            new AWS.Kendra({apiVersion: '2019-02-03', region: process.env.REGION}) :
            new AWS.Kendra({apiVersion: '2019-02-03'})
        );
    }

    // process query against Kendra for QnABot
    let indexes = event.req["_settings"]["ALT_SEARCH_KENDRA_INDEXES"] ? event.req["_settings"]["ALT_SEARCH_KENDRA_INDEXES"] : process.env.KENDRA_INDEXES
    var kendraResultsCached = _.get(event.res, "kendraResultsCached");
    if (indexes && indexes.length) {
        try {
            // parse JSON array of kendra indexes
            kendraIndexes = JSON.parse(indexes);
        } catch (err) {
            // assume setting is a string containing single index
            kendraIndexes = [ indexes ];
        }
    }
    if (kendraIndexes === undefined) {
        throw new Error('Undefined Kendra Indexes');
    }
    
    // This function can handle configuration with an array of kendraIndexes.
    // Iterate through this area and perform queries against Kendra.
    kendraIndexes.forEach(function (index, i) {
        // if results cached from KendraFAQ, skip index by pushing Promise to resolve cached results
        if (kendraResultsCached && index===kendraResultsCached.originalKendraIndexId) {
            console.log(`retrieving cached kendra results`)
            
            promises.push(new Promise(function(resolve, reject) {
                var data = kendraResultsCached
                _.set(event.req, "kendraResultsCached", "cached and retrieved");  // cleans the logs
                data.originalKendraIndexId = index;
                console.log("Data from Kendra request:" + JSON.stringify(data,null,2));
                resArray.push(data);
                resolve(data);
            }));
            return;
        }
        
        const params = {
            IndexId: index, /* required */
            QueryText: event.req["question"], /* required */
        };
        let p = kendraRequester(kendraClient,params,resArray);
        promises.push(p);
    });

    // wait for all kendra queries to complete
    await Promise.all(promises);

    // process kendra query responses and update answer content

    /* default message text - can be overridden using QnABot SSM Parameter Store Custom Property */
    let topAnswerMessage = event.req["_settings"]["ALT_SEARCH_KENDRA_TOP_ANSWER_MESSAGE"] + "\n\n"; //"Amazon Kendra suggested answer. \n\n ";
    let topAnswerMessageMd = event.req["_settings"]["ALT_SEARCH_KENDRA_TOP_ANSWER_MESSAGE"] == "" ? "" : `*${event.req["_settings"]["ALT_SEARCH_KENDRA_TOP_ANSWER_MESSAGE"]}* \n `;
    let answerMessage = event.req["_settings"]["ALT_SEARCH_KENDRA_ANSWER_MESSAGE"];
    let answerMessageMd = event.req["_settings"]["ALT_SEARCH_KENDRA_ANSWER_MESSAGE"] == "" ? "" : `*${answerMessage}* \n `;
    let faqanswerMessage = 'Answer from Amazon Kendra FAQ.';
    let faqanswerMessageMd = '*Answer from Amazon Kendra FAQ.* \n ';
    let speechMessage = "";
    let helpfulLinksMsg = 'Source Link';
    let maxDocumentCount = _.get(event.req,'_settings.ALT_SEARCH_KENDRA_MAX_DOCUMENT_COUNT',2);
    var seenTop = false;

    let foundAnswerCount = 0;
    let foundDocumentCount = 0;
    let kendraQueryId;
    let kendraIndexId;
    let kendraResultId;
    let answerDocumentUris = new Set();
    let helpfulDocumentsUris = new Set();
    let signS3Urls = _.get(event.req,"_settings.ALT_SEARCH_KENDRA_S3_SIGNED_URLS",true);
    let expireSeconds = _.get(event.req,"_settings.ALT_SEARCH_KENDRA_S3_SIGNED_URL_EXPIRE_SECS",300);

    
    resArray.forEach(function (res) {
        if (res && res.ResultItems.length > 0) {
            res.ResultItems.forEach(function (element, i) {
                /* Note - only the first answer will be provided back to the requester */
                if (element.Type === 'ANSWER' && foundAnswerCount === 0 && element.AdditionalAttributes &&
                    element.AdditionalAttributes.length > 0 &&
                    element.AdditionalAttributes[0].Value.TextWithHighlightsValue.Text) {
                    answerMessage += '\n\n ' + element.AdditionalAttributes[0].Value.TextWithHighlightsValue.Text.replace(/\r?\n|\r/g, " ");
                    
                    // Emboldens the highlighted phrases returned by the Kendra response API in markdown format
                    let answerTextMd = element.AdditionalAttributes[0].Value.TextWithHighlightsValue.Text.replace(/\r?\n|\r/g, " ");
                    // iterates over the answer highlights in sorted order of BeginOffset, merges the overlapping intervals
                    let sorted_highlights = mergeIntervals(element.AdditionalAttributes[0].Value.TextWithHighlightsValue.Highlights);
                    let j, elem;
                    for (j=0; j<sorted_highlights.length; j++) {
                        elem = sorted_highlights[j];
                        let offset = 4*j;

                        if (elem.TopAnswer == true) {   // if top answer is found, then answer is abbreviated to this phrase
                            seenTop = true;
                            answerMessage = topAnswerMessage + highlight + '.';
                            answerMessageMd = topAnswerMessageMd;
                            answerTextMd = addMarkdownHighlights(answerTextMd, elem.BeginOffset+offset, elem.EndOffset+offset, true) ;
                            break;
                        } else {
                            answerTextMd = addMarkdownHighlights(answerTextMd, elem.BeginOffset+offset, elem.EndOffset+offset, false) ;
                        }
                    }
                    answerMessageMd = answerMessageMd + '\n\n' + answerTextMd;
                    
                    // Shortens the speech response to contain say the longest highlighted phrase ONLY IF top answer not found
                    if (seenTop == false) {
                        var longest_highlight = longestInterval(sorted_highlights);
                        let answerText = element.AdditionalAttributes[0].Value.TextWithHighlightsValue.Text.replace(/\r?\n|\r/g, " ");
                        // speechMessage = answerText.substring(longest_highlight.BeginOffset, longest_highlight.EndOffset) + '.';

                        var pattern = new RegExp('[^.]* '+longest_highlight+'[^.]*\.[^.]*\.')
                        pattern.lastIndex = 0;  // must reset this property of regex object for searches
                        speechMessage = pattern.exec(answerText)[0]
                    }
                    
                    // Convert S3 Object URLs to signed URLs
                    let uri = element.DocumentURI ;
                    answerDocumentUris.add(element);
                    kendraQueryId = res.QueryId; // store off the QueryId to use as a session attribute for feedback
                    kendraIndexId = res.originalKendraIndexId; // store off the Kendra IndexId to use as a session attribute for feedback
                    kendraResultId = element.Id; // store off resultId to use as a session attribute for feedback
                    foundAnswerCount++;

                } else if (element.Type === 'QUESTION_ANSWER' && element.AdditionalAttributes && element.AdditionalAttributes.length > 1) {
                    // There will be 2 elements - [0] - QuestionText, [1] - AnswerText
                    answerMessage = faqanswerMessage + '\n\n ' + element.AdditionalAttributes[1].Value.TextWithHighlightsValue.Text.replace(/\r?\n|\r/g, " ");
                    
                    seenTop = true; // if the answer is in the FAQ, don't show document extracts
                    answerDocumentUris=[];
                    let answerTextMd = element.AdditionalAttributes[1].Value.TextWithHighlightsValue.Text.replace(/\r?\n|\r/g, " ");
                    // iterates over the FAQ answer highlights in sorted order of BeginOffset, merges the overlapping intervals
                    let sorted_highlights = mergeIntervals(element.AdditionalAttributes[1].Value.TextWithHighlightsValue.Highlights);
                    let j, elem;
                    for (j=0; j<sorted_highlights.length; j++) {
                        elem = sorted_highlights[j];
                        let offset = 4*j;
                        answerTextMd = addMarkdownHighlights(answerTextMd, elem.BeginOffset+offset, elem.EndOffset+offset, false) ;
                    }
                    answerMessageMd = faqanswerMessageMd + '\n\n' + answerTextMd;
                    
                    kendraQueryId = res.QueryId; // store off the QueryId to use as a session attribute for feedback
                    kendraIndexId = res.originalKendraIndexId; // store off the Kendra IndexId to use as a session attribute for feedback
                    kendraResultId = element.Id; // store off resultId to use as a session attribute for feedback
                    foundAnswerCount++;
                    
                } else if (element.Type === 'DOCUMENT' && element.DocumentExcerpt.Text && element.DocumentURI) {
                    const docInfo = {}
                    // if topAnswer found, then do not show document excerpts
                    if (seenTop == false) {
                        docInfo.text = element.DocumentExcerpt.Text.replace(/\r?\n|\r/g, " ");
                        // iterates over the document excerpt highlights in sorted order of BeginOffset, merges overlapping intervals
                        var sorted_highlights = mergeIntervals(element.DocumentExcerpt.Highlights);
                        var j, elem;
                        for (j=0; j<sorted_highlights.length; j++) {
                            elem = sorted_highlights[j];
                            let offset = 4*j;
                            let beginning = docInfo.text.substring(0, elem.BeginOffset+offset);
                            let highlight = docInfo.text.substring(elem.BeginOffset+offset, elem.EndOffset+offset);
                            let rest = docInfo.text.substr(elem.EndOffset+offset);
                            docInfo.text = beginning + '**' + highlight + '**' + rest;
                        };
                        
                        if (foundAnswerCount == 0 && foundDocumentCount == 0) {
                            speechMessage = element.DocumentExcerpt.Text.replace(/\r?\n|\r/g, " ");;
                            if (sorted_highlights.length > 0) {
                                var highlight = speechMessage.substring(sorted_highlights[0].BeginOffset, sorted_highlights[0].EndOffset)
                                var pattern = new RegExp('[^.]* '+highlight+'[^.]*\.[^.]*\.')
                                pattern.lastIndex = 0;  // must reset this property of regex object for searches
                                var regexMatch = pattern.exec(speechMessage)
                                //TODO: Investigate this.  Should this be a nohits scenerio?
                                if(regexMatch){
                                    speechMessage = regexMatch[0]
                                }
                            }
                        }
                    }
                  // but even if topAnswer is found, show URL in markdown
                  docInfo.uri = element.DocumentURI;
                  let title;
                  if (element.DocumentTitle && element.DocumentTitle.Text) {
                    docInfo.Title = element.DocumentTitle.Text;
                  }
                  helpfulDocumentsUris.add(docInfo);
                  // foundAnswerCount++;
                  foundDocumentCount++;
                }
            });
        }
    });

    // update QnABot answer content for ssml, markdown, and text
    let ssmlMessage = ""
    if (foundAnswerCount > 0 || foundDocumentCount > 0) {
        event.res.session.qnabot_gotanswer = true ; 
        event.res.message = answerMessage;
        event.res.card = [];

        ssmlMessage = `${answerMessage.substring(0,600).replace(/\r?\n|\r/g, " ")}`;
        if (speechMessage != "") {
            ssmlMessage = `${speechMessage.substring(0,600).replace(/\r?\n|\r/g, " ")}`;
        }
        
        let lastIndex = ssmlMessage.lastIndexOf('.');
        if (lastIndex > 0) {
            ssmlMessage = ssmlMessage.substring(0,lastIndex);
        }
        ssmlMessage = `<speak> ${ssmlMessage} </speak>`;
        
        event.res.session.appContext.altMessages.markdown = answerMessageMd;
        event.res.session.appContext.altMessages.ssml = ssmlMessage;
        if (event.req._preferredResponseType == "SSML") {
            event.res.message = ssmlMessage;
            event.res.type = 'SSML';
            event.res.plainMessage = answerMessage;
        }
    }
    if (answerDocumentUris.size > 0) {
      event.res.session.appContext.altMessages.markdown += `\n\n ${helpfulLinksMsg}: `;
      answerDocumentUris.forEach(function(element) {
        // Convert S3 Object URLs to signed URLs
        if (signS3Urls) {
          element = signS3URL(element.DocumentURI, expireSeconds);
        }
        event.res.session.appContext.altMessages.markdown += `[${element.DocumentTitle.Text}](${element.DocumentURI})`;
      });
    }
    
    let idx=foundAnswerCount;
    if (seenTop == false){
        helpfulDocumentsUris.forEach(function (element) {
            if (idx++ < maxDocumentCount-seenTop) {
                event.res.session.appContext.altMessages.markdown += `\n\n`;
                event.res.session.appContext.altMessages.markdown += `***`;
                event.res.session.appContext.altMessages.markdown += `\n\n <br>`;
                
                if (element.text && element.text.length > 0 && event.req._preferredResponseType != "SSML") { //don't append doc search to SSML answers
                    event.res.session.appContext.altMessages.markdown += `\n\n  ${element.text}`;
                    event.res.message += `\n\n  ${element.text}`;
                }
                let label = element.Title ;
                // Convert S3 Object URLs to signed URLs
                if (signS3Urls) {
                    element.uri = signS3URL(element.uri, expireSeconds)
                }
                event.res.session.appContext.altMessages.markdown += `\n\n  ${helpfulLinksMsg}: [${label}](${element.uri})`;
            }
        });
    }


      // translate response
    var usrLang = "en";
    if (_.get(event.req._settings, "ENABLE_MULTI_LANGUAGE_SUPPORT")) {
        console.log("Translating response....")
        usrLang = _.get(event.req, "session.userDetectedLocale");
      if (usrLang != "en") {
        console.log("Autotranslate hit to usrLang: ", usrLang);
        var hit = {
            a:answerMessage,
            markdown: event.res.session.appContext.altMessages.markdown,
            ssml: ssmlMessage
        }
        var translated_hit= await translate.translate_hit(hit, usrLang, event.req);
        event.res.session.appContext.altMessages.markdown = translated_hit.markdown;
        event.res.session.appContext.altMessages.ssml = translated_hit.ssml;
        event.res.plainMessage = translated_hit.a;
        event.res.message = translated_hit.markdown;

      } else {
        console.log("User Lang is en, Autotranslate not required.");
      }
    }
    
    
    _.set(event,"res.answerSource",'KENDRA');
    if (kendraQueryId) {
        _.set(event,"res.session.qnabotcontext.kendra.kendraQueryId",kendraQueryId) ;
        _.set(event,"res.session.qnabotcontext.kendra.kendraIndexId",kendraIndexId) ;
        _.set(event,"res.session.qnabotcontext.kendra.kendraResultId",kendraResultId) ;
//        _.set(event,"res.session.qnabotcontext.kendra.kendraResponsibleQid",event.res.result.qid) ;
    }
    
    console.log("Returning event: ", JSON.stringify(event, null, 2));

    return event;
}

exports.handler = async (event, context) => {
    console.log("event: " + JSON.stringify(event, null, 2));
    console.log('context: ' + JSON.stringify(context, null, 2));
    return routeKendraRequest(event, context);
};