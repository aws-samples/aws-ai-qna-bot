/**
 *
 * Lex Bot Router. Given the name of a bot, Call bot using $LATEST and pass input text.
 * Handle response from Lex Bot and update session attributes as needed.
 */
const _=require('lodash');
const AWS = require('aws-sdk');
const FREE_TEXT_ELICIT_RESPONSE_NAME = 'QNAFreeText';
const QNANumber = "QNANumber";;
const QNAWage = "QNAWage";
const QNASocialSecurity  = "QNASocialSecurity"
const QNAPin = "QNAPin";
const QNADate = "QNADate";
const QNADateNoConfirm = "QNADateNoConfirm";
const QNADayOfWeek = "QNADayOfWeek";
const QNAMonth = "QNAMonth"
const QNAAge = "QNAAge";
const QNAPhoneNumber = "QNAPhoneNumber";
const QNAPhoneNumberNoConfirm = "QNAPhoneNumberNoConfirm";
const QNATime = "QNATime";
const QNAEmailAddress = "QNAEmailAddress";
const QNAName = "QNAName";
const QNAYesNo = "QNAYesNo";
const QNAYesNoExit = "QNAYesNoExit";

const translate = require('./multilanguage.js');

function isConnectClient(req) {
    if (_.get(req,"_event.requestAttributes.x-amz-lex:accept-content-types", undefined) === undefined) {
        return false;
    }
    return true;
}

async function get_terminologies(sourceLang,allowedList =[]){
    const translate = new AWS.Translate();
        allowedList = allowedList.filter(a => a.length > 0)
        console.log("Getting registered custom terminologies")

        var configuredTerminologies = await  translate.listTerminologies({}).promise()



        console.log("terminology response " + JSON.stringify(configuredTerminologies))
        var sources = configuredTerminologies["TerminologyPropertiesList"].filter(t => t["SourceLanguageCode"] == sourceLang).map(s => s.Name);
        console.log("Filtered Sources " + JSON.stringify(sources))
        if(allowedList.length != 0){
            sources = _.intersection(sources,allowedList)
        }

        return sources


}

async function get_translation(inputText, sourceLang, targetLang,req ) {
    var customTerminologyEnabled = _.get(req._settings,"ENABLE_CUSTOM_TERMINOLOGY") == true;
    var customTerminologies = _.get(req._settings,"CUSTOM_TERMINOLOGY_SOURCES","").split(",");
    console.log("get translation request " + JSON.stringify(inputText))
    const params = {
        SourceLanguageCode: sourceLang, /* required */
        TargetLanguageCode: targetLang, /* required */
        Text: inputText, /* required */
    };
    console.log("get_translation:", targetLang, "InputText: ", inputText);
    if (targetLang === sourceLang) {
        console.log("get_translation: source and target are the same, translation not required.");
        return inputText;
    }
    if(customTerminologyEnabled){
        customTerminologies = await get_terminologies(sourceLang,customTerminologies)

        if(customTerminologies.length == 0){
            console.log("Warning: ENABLE_CUSTOM_TERMINOLOGY is set to true, but no entries found for CUSTOM_TERMINOLOGY_SOURCES ")
        }else{
            params["TerminologyNames"] = customTerminologies;
        }
    }

    const translateClient = new AWS.Translate();
    try {
        console.log("Fullfilment params " + JSON.stringify(params))
        const translation = await translateClient.translateText(params).promise();
        return translation.TranslatedText;
    } catch (err) {
        console.log("warning - error during translation. Returning: " + inputText);
        const res = {};
        res.TranslatedText = inputText;
        return res;
    }
}


async function translate_res(req, res){
    const locale = _.get(req, 'session.userLocale');
    if (_.get(req._settings, 'ENABLE_MULTI_LANGUAGE_SUPPORT')){
        if (_.get(res,"message")) {
            res.message = await get_translation(res.message,'en',locale,req); 
        }
        if (_.get(res,"plainMessage")) {
            res.plainMessage = await get_translationt(res.plainMessage,'en',locale,req); 
        }
        if (_.get(res,"card")) {
            res.card.title = await get_translation(res.card.title,'en',locale,req);
        }
        if (_.get(res,"card.buttons")) {
            res.card.buttons.forEach(async function (button) {
                button.text = await get_translation(button.text,'en',locale,req);
                //TODO Address multilanguage issues with translating button values for use in confirmation prompts
                //Disable translate of button value
                //button.value = await translate.translateText(button.value,'en',locale);
            });
            res.plainMessage = await get_translation(res.plainMessage,'en',locale,req); 
        }
    }
    return res;
}

/**
 * Call postText and use promise to return data response.
 * @param lexClient
 * @param params
 * @returns {*}
 */
function lexClientRequester(lexClient,params) {
    return new Promise(function(resolve, reject) {
        lexClient.postText(params, function(err, data) {
            if (err) {
                console.log(err, err.stack);
                reject('Lex client request error:' + err);
            }
            else {
                console.log("Lex client response:" + JSON.stringify(data, null, 2));
                resolve(data);
            }
        });
    });
}

/**
 * Setup call to Lex including user ID, input text, botName, botAlis. It is an async function and
 * will return the response form Lex.
 * @param req
 * @param res
 * @param botName
 * @param botAlias
 * @returns {Promise<*>}
 */
async function handleRequest(req, res, botName, botAlias) {
    function mapFromSimpleName(botName) {
        const bName = process.env[botName];
        return bName ? bName : botName;
    }
    function getFreeTextResponse(inputText, sentiment, sentimentScore) {
        let response = {
            message: "",
            slots: { 'FreeText' : inputText,
                'Sentiment' : sentiment,
                'SentimentPositive': _.get(sentimentScore, 'Positive', ''),
                'SentimentNegative': _.get(sentimentScore, 'Negative', ''),
                'SentimentNeutral': _.get(sentimentScore, 'Neutral', ''),
                'SentimentMixed': _.get(sentimentScore, 'Mixed', '')
            },
            dialogState: 'Fulfilled',
        } ;
        return response;
    }

    let tempBotUserID = _.get(req,"_userInfo.UserId","nouser");
    tempBotUserID = tempBotUserID.substring(0, 100); // Lex has max userId length of 100
    if (botName === FREE_TEXT_ELICIT_RESPONSE_NAME) {
        return getFreeTextResponse(_.get(req, "question"), _.get(req, "sentiment"), _.get(req, "sentimentScore"));
    } else {
        const lexClient = new AWS.LexRuntime({apiVersion: '2016-11-28'});

        // if a connect client and an elicitResponse bot such as QNANumber and the user is confirming the response
        // from the bot, proxy a key pad press (phone touch) of 1 for Yes and 2 for No. This helps accessibility
        // when confirming responses to a Lex intent.
        let respText = _.get(req, "question");
        let progress = _.get(req, "session.qnabotcontext.elicitResponse.progress", undefined);
        if (isConnectClient(req) && ( botName != QNAYesNo && botName != QNAYesNoExit) && progress === 'ConfirmIntent') {
            if (respText === '1' || respText.toLowerCase() === 'one' || respText.toLowerCase() === 'correct' ) respText = 'Yes';
            if (respText === '2' || respText.toLowerCase() === 'two' ) respText = 'No';
        }
        if ((botName === QNAPhoneNumber || botName === QNAPhoneNumberNoConfirm) && ( progress === 'ElicitSlot' || progress === 'ElicitIntent' || progress === "" || progress === undefined ) ) {
            respText = 'my number is ' + respText;
        }
        if ((botName === QNADate || botName === QNADateNoConfirm) && ( progress === 'ElicitSlot' || progress === 'ElicitIntent' || progress === "" || progress === undefined ) ) {
            respText = 'the date is ' + respText;
        }
        // call the Bot using the respText
        const params = {
            botAlias: botAlias,
            botName: mapFromSimpleName(botName),
            inputText: respText,
            userId: tempBotUserID,
        };
        console.log("Lex parameters: " + JSON.stringify(params));
        const response = await lexClientRequester(lexClient, params);
        return response;
    }
};

/**
 * Main processing logic to handle request from 3_query.js and process response from Lex. Handles
 * dialogState response from Lex.
 * @param req
 * @param res
 * @param hook
 * @returns {Promise<{}>}
 */
async function processResponse(req, res, hook, msg) {

    function indicateFailure(req, res, errmsg) {
        let namespace = _.get(res,'session.qnabotcontext.elicitResponse.namespace', undefined);
        if (namespace) {
            _.set(res.session,namespace + '.boterror','true');
        }
        _.set(res,'session.qnabotcontext.elicitResponse.progress','Failed');
        _.set(res,'session.qnabotcontext.elicitResponse.responsebot',undefined);
        _.set(res,'session.qnabotcontext.elicitResponse.namespace',undefined);
        _.set(res,'session.qnabotcontext.elicitResponse.loopCount',0);
        res.card = undefined;

        let chainingConfig = _.get(res,'session.qnabotcontext.elicitResponse.chainingConfig',undefined);
        if (chainingConfig === undefined) {
            res.message = errmsg;
            res.plainMessage = errmsg;
        }
    }

    const maxElicitResponseLoopCount = _.get(req, '_settings.ELICIT_RESPONSE_MAX_RETRIES', 5);
    const elicit_Response_Retry_Message = _.get(req, '_settings.ELICIT_RESPONSE_RETRY_MESSAGE', "Please try again?");

    let botResp = await handleRequest(req, res, hook, "live");
    console.log("botResp: " + JSON.stringify(botResp,null,2));
    var plainMessage = botResp.message;
    var ssmlMessage = undefined;
    // if messsage contains SSML tags, strip tags for plain text, but preserve tags for SSML 
    if (plainMessage && plainMessage.includes("<speak>")) {
        ssmlMessage = botResp.message  ;        
        plainMessage = plainMessage.replace(/<\/?[^>]+(>|$)/g, "");
    }
    let elicitResponseLoopCount =_.get(res,"session.qnabotcontext.elicitResponse.loopCount", 0);
    if (botResp.dialogState === 'ConfirmIntent') {
        _.set(res,'session.qnabotcontext.elicitResponse.progress','ConfirmIntent');
        res.plainMessage = plainMessage;      
        // if SSML tags were present and client supports SSML then build SSML response
        if (ssmlMessage && req._preferredResponseType == "SSML") {
            res.type = "SSML";
            res.message = ssmlMessage;
        } else {
            res.message = plainMessage;
        }
        res.card = {
            "send": true,
            "title": "Info",
            "text": "",
            "url": "",
            "subTitle": "",
            "imageUrl": "",
            "buttons": [
                {
                    "text": "Yes",
                    "value": "Yes"
                },
                {
                    "text": "No",
                    "value": "No"
                }
            ]
        };
    } else if (botResp.dialogState === 'Failed') {
        _.set(res,'session.qnabotcontext.elicitResponse.loopCount',++elicitResponseLoopCount);
        if (elicitResponseLoopCount >= maxElicitResponseLoopCount) {
            indicateFailure(req, res, _.get(req, '_settings.ELICIT_RESPONSE_BOT_FAILURE_MESSAGE', 'Your response was not understood. Please start again.'));
        } else {
            _.set(res,'session.qnabotcontext.elicitResponse.progress','ErrorHandling');
            res.message = elicit_Response_Retry_Message;
            res.plainMessage = elicit_Response_Retry_Message;
            res.card = undefined;
        }
    } else if (botResp.dialogState === 'ElicitIntent' || botResp.dialogState === 'ElicitSlot') {
        _.set(res,'session.qnabotcontext.elicitResponse.progress',botResp.dialogState);
        if (botResp.message) {
            res.message = botResp.message;
            res.plainMessage = botResp.message;
        } else {
            res.message = elicit_Response_Retry_Message;
            res.plainMessage = elicit_Response_Retry_Message;
        }
        res.card = undefined;
    } else if (botResp.dialogState === 'Fulfilled' || botResp.dialogState === 'ReadyForFulfillment') {
        if (botResp.message) {
            res.message = botResp.message;
            res.plainMessage = botResp.message;
        } else {
            res.message = undefined;
            res.plainMessage = undefined;
        }
        _.set(res,'session.qnabotcontext.elicitResponse.progress',botResp.dialogState);
        _.set(res.session,res.session.qnabotcontext.elicitResponse.namespace,botResp.slots);
        _.set(res,'session.qnabotcontext.elicitResponse.responsebot',undefined);
        _.set(res,'session.qnabotcontext.elicitResponse.namespace',undefined);
    } else {
        if (botResp.message) {
            res.message = botResp.message;
            res.plainMessage = botResp.message;
        } else {
            res.message = elicit_Response_Retry_Message;
            res.plainMessage = elicit_Response_Retry_Message;
        }
        _.set(res,'session.qnabotcontext.elicitResponse.progress',botResp.dialogState);
    }

    // as much as we'd like to return an empty message, QnABot semantics requires some message to
    // be returned.
    res.message = res.message ? res.message : _.get(req, '_settings.ELICIT_RESPONSE_DEFAULT_MSG', 'Ok. ');
    res.plainMessage = res.plainMessage ? res.plainMessage : _.get(req, '_settings.ELICIT_RESPONSE_DEFAULT_MSG', 'Ok. ');
    
    // autotranslate res fields
    res = await translate_res(req,res);

    // set res.session.qnabot_gotanswer
    _.set(res,'session.qnabot_gotanswer',true) ;

    const resp = {};
    resp.req = req;
    resp.res = res;
    return resp;
}

exports.elicitResponse=processResponse;