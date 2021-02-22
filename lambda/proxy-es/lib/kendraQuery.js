/**
 * optional environment variables - These are not used defined during setup of this function in QnABot but are
 * useful for testing if defined.
 *
 * REGION - optional AWS region to target
 *
 */

var _ = require('lodash');
const AWS = require('aws-sdk');
var build_es_query = require('./esbodybuilder');
var request = require('./request');


async function run_query_es(params, qid) {
    console.log("run_query_es params: ", params);
    let question = "qid::"+qid;
    var es_query = await build_es_query({question:question});
    var es_response = await request({
        url: `https://${params.es_address}${params.es_path}`,
        method: "GET",
        body: es_query
    });
    console.log("run_query_es result: ", JSON.stringify(es_response, null, 2));
    return es_response;
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


/** Function that returns if a string has JSON structure
 * @param str - input string
 * @returns boolean true or false
 */
function hasJsonStructure(str) {
    if (typeof str !== 'string') return false;
    try {
        const result = JSON.parse(str);
        const type = Object.prototype.toString.call(result);
        return type === '[object Object]' 
            || type === '[object Array]';
    } catch (err) {
        return false;
    }
}


async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}


/** Function that processes kendra requests and handles response. Decides whether to handle SNS
 * events or Lambda Hook events from QnABot.
 * @param request - request parameters object
//  * @param event - input event passed to the Lambda Handler
//  * @param context - input context passed to the Lambda Handler
 * @returns {Promise<*>} - returns the response in event.res
 */
async function routeKendraRequest(request_params) {
    
    AWS.config.update({
      maxRetries: request_params.maxRetries,
      retryDelayOptions: {
        base: request_params.retryDelay
      },
    });
    
    var kendraClient = (process.env.REGION ?
            new AWS.Kendra({apiVersion: '2019-02-03', region: process.env.REGION}) :
            new AWS.Kendra({apiVersion: '2019-02-03'})
        );
        
    
    let promises = [];
    let resArray = [];
    let kendraIndexes = undefined;
    let kendraFaqIndex = request_params.kendra_faq_index;
    if (kendraFaqIndex != "" && kendraFaqIndex != undefined) {
        kendraIndexes = [kendraFaqIndex];
    } else {
        throw new Error("Undefined KendraFAQIndex: " + kendraFaqIndex);
    }
    // Iterate through this area and perform queries against Kendra.
    kendraIndexes.forEach(function (index, i) {
        const params = {
            IndexId: index, /* required */
            QueryText: request_params.question
        };
        let p = kendraRequester(kendraClient,params,resArray);
        promises.push(p);
    });
    await Promise.all(promises);


    // ----- process kendra query responses and update answer content -----

    /* default message text - can be overridden using QnABot SSM Parameter Store Custom Property */
    let foundAnswerCount = 0;
    let kendraQueryId;
    let kendraIndexId;
    let kendraResultId;
    let json_struct = [];
    
    
    // note that this outside for loop will only execute once (one FAQ index) but the structure was kept due to its elegance
    //resArray.forEach(async function (res) {
    await asyncForEach(resArray, async function (res) {
        if (res && res.ResultItems && res.ResultItems.length > 0) {
            
            var i, element;
            for (i=0; i<res.ResultItems.length; i++) {
                element = res.ResultItems[i];
                /* Note - only FAQ format will be provided back to the requester */
                if (element.Type === 'QUESTION_ANSWER' && foundAnswerCount < request_params.size && element.AdditionalAttributes &&
                    element.AdditionalAttributes.length > 1) {

                    if (!hasJsonStructure(element.DocumentURI)) {
                        break;
                    }
                    var hit = JSON.parse(element.DocumentURI);
                    if (_.get(hit,"_source_qid")) {
                        let qid = hit._source_qid ;
                        // FAQ only references the QID but doesn't contain the full docunment.. retrieve it from ES
                        console.log("Kendra matched qid: ", qid, ". Retrieving full document from Elasticsearch.");
                        let es_response = await run_query_es(request_params, qid) ;
                        console.log("Qid document from Elasticsearch: ", JSON.stringify(hit));
                        hit = _.get(es_response, "hits.hits[0]._source");
                    }
                    
                    console.log(`hit is ${JSON.stringify(hit)}`);
                    json_struct.push(hit);

                    kendraQueryId = res.QueryId; // store off the QueryId to use as a session attribute for feedback
                    kendraIndexId = res.originalKendraIndexId; // store off the Kendra IndexId to use as a session attribute for feedback
                    kendraResultId = element.Id; // store off resultId to use as a session attribute for feedback
                    foundAnswerCount++;
                }
            }
        }
    });
    
    // return query response structure to make Kendra results look like ES results so we don't have to change the UI
    var hits_struct = {
        // "took": 104,
        "timed_out": false,
        "hits": {
            "total": {
                "value": foundAnswerCount,  // if no answers found, total hits # is 0 and hits list is empty
                "relation": "eq"
            },
            "max_score": json_struct.length,
            "hits": [],
        },
    }
    if (kendraQueryId) {
        hits_struct.kendra_context = {
            "kendraQueryId":kendraQueryId,
            "kendraIndexId":kendraIndexId,
            "kendraResultId":kendraResultId,
            "kendraResponsibleQid":"KendraFAQ"
        }
    }

    
    let ans = {};
    var j, faq_struct;
    var num=json_struct.length;
    if (request_params.size) {
        num = Math.min(num, request_params.size);
    }
    for (j=0; j<num; j++) {
        faq_struct = json_struct[j];
        
        ans = {
            "_index": request_params.kendra_faq_index,
            "_type": "_faq",
            "_id": faq_struct.qid,
            "_score": json_struct.length-j, // score is inverse ranking of returned results
            "_source": faq_struct
        }
        hits_struct.hits.hits.push(ans);
    }
    
    // cache kendra results to optimize fallback engine
    if (request_params.same_index && resArray.length>0) {
        hits_struct['kendraResultsCached'] = resArray[0];
    }
    
    console.log("RETURN: " + JSON.stringify(hits_struct));
    return hits_struct;
}

exports.handler = async (request_params) => {
    console.log("kendra query request: " + JSON.stringify(request_params));
    return routeKendraRequest(request_params);
};
