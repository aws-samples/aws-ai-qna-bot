var _=require('lodash');
var Promise=require('bluebird');
var util=require('./util');
var jwt=require('./jwt');
var AWS=require('aws-sdk');

async function get_userInfo(userId, idattrs) {
    var default_userInfo = {
        UserId:userId,
        InteractionCount:1
    };
    var usersTable = process.env.DYNAMODB_USERSTABLE;
    var docClient = new AWS.DynamoDB.DocumentClient({apiVersion: '2012-08-10'});
    var params = {
        TableName: usersTable,
        Key: {
            'UserId': userId
        },
    };
    console.log("Getting user info for user: ", userId, "from DynamoDB table: ", usersTable);
    var ddbResponse = {};
    try {
        ddbResponse = await docClient.get(params).promise();
    }catch(e){
        console.log("DDB Exception caught.. can't retrieve userInfo: ", e)
    }
    console.log("DDB Response: ", ddbResponse);
    var req_userInfo = _.get(ddbResponse,"Item",default_userInfo);
    // append user identity attributes if known
    if (_.get(idattrs,'preferred_username')) {
        _.set(req_userInfo, 'UserName', _.get(idattrs,'preferred_username'));
    }
    if (_.get(idattrs,'given_name')) {
        _.set(req_userInfo, 'GivenName', _.get(idattrs,'given_name'));
    }
    if (_.get(idattrs,'family_name')) {
        _.set(req_userInfo, 'FamilyName', _.get(idattrs,'family_name'));
    }
    if (_.get(idattrs,'email')) {
        _.set(req_userInfo, 'Email', _.get(idattrs,'email'));
    }
    if (_.get(idattrs,'verifiedIdentity')) {
        _.set(req_userInfo, 'isVerifiedIdentity', _.get(idattrs,'verifiedIdentity'));
    }
    if (_.get(idattrs, 'profile')) {
        _.set(req_userInfo, 'Profile', _.get(idattrs, 'profile'));
    }
    // append time since last seen
    var now = new Date();
    var lastSeen = Date.parse(req_userInfo.LastSeen || "1970/1/1 12:00:00");
    var timeSinceLastInteraction = Math.abs(now - lastSeen)/1000; // seconds
    _.set(req_userInfo, 'TimeSinceLastInteraction', timeSinceLastInteraction);
    console.log("Request User Info: ", req_userInfo);
    return req_userInfo;
}

async function update_userInfo(userId, req_userInfo) {
    var res_userInfo = _.cloneDeep(req_userInfo);
    var dt = new Date();
    res_userInfo.FirstSeen = req_userInfo.FirstSeen || dt.toString();
    res_userInfo.LastSeen = dt.toString();
    res_userInfo.InteractionCount = req_userInfo.InteractionCount + 1;
    console.log("Response User Info: ", res_userInfo);
    return res_userInfo;
}

const comprehend_client = new AWS.Comprehend();

const isPIIDetected = async (text,useComprehendForPII,piiRegex,pii_rejection_ignore_list) => {


    console.log("Testing redaction ")
    if(piiRegex){
        let re = new RegExp(piiRegex,"g");
        let redacted_text = text.replace(re,"XXXXXX");
        console.log(`redacted_text ${redacted_text} text ${text}`)
        var result = redacted_text != text;
        console.log(`Is Redacted ${result}`)
        if(result) //if the regex was returned. No need to call Comprehend
            return result;
    } else {
        console.log("Warning: No value found for setting  PII_REJECTION_REGEX not using REGEX Matching")
    }
    if(useComprehendForPII){
        var params = {
                LanguageCode: "en",
                Text: text
            };
            try
            {
                var comprehendResult = await comprehend_client.detectPiiEntities(params).promise();
                console.log(JSON.stringify(comprehendResult) + "entity count == " + comprehendResult.Entities.length )
                if(!("Entities" in comprehendResult) ||  comprehendResult.Entities.length == 0)
                {
                    console.log("No PII found by Comprehend")
                    return false;
                }
                console.log("Ignoring types for PII == " + pii_rejection_ignore_list)
                pii_rejection_ignore_list = pii_rejection_ignore_list.toLowerCase().split(",")

                return comprehendResult.Entities.filter(entity => entity.Score > 0.90 && pii_rejection_ignore_list.indexOf(entity.Type.toLowerCase()) == -1).length > 0;;

            }catch(exception)
            {
                console.log("Warning: Exception while trying to detect PII with Comprehend. Skipping...");
                console.log("Exception " + exception);
                return false;
            }
    
    }


}




module.exports=async function preprocess(req,res){

    // lex-web-ui: If idtoken session attribute is present, decode it
    var idtoken = _.get(req,'session.idtokenjwt');
    var idattrs={"verifiedIdentity":"false"};
    if (idtoken) {
        var decoded = jwt.decode(idtoken);
        if (decoded) {
            idattrs = _.get(decoded,'payload');
            console.log("Decoded idtoken:",idattrs);
            var kid = _.get(decoded,'header.kid');
            console.log()
            var default_jwks_url = [_.get(req,'_settings.DEFAULT_USER_POOL_JWKS_URL')];
            var identity_provider_jwks_url = _.get(req,'_settings.IDENTITY_PROVIDER_JWKS_URLS');
            if (identity_provider_jwks_url && identity_provider_jwks_url.length) {
                try {
                    identity_provider_jwks_url = JSON.parse(identity_provider_jwks_url);
                } catch (err) {
                    true
                }
            }
            var urls = default_jwks_url.concat(identity_provider_jwks_url);
            console.log("Attempt to verify idtoken using jwks urls:",urls);
            var verified_url = await jwt.verify(idtoken,kid,urls) ;
            if (verified_url) {
                _.set(idattrs,'verifiedIdentity',"true");
                console.log("Verified identity with:",verified_url);
            } else {
                _.set(idattrs,'verifiedIdentity',"false");
                console.log("Unable to verify identity for any configured IdP jwks urls");
            }     
        } else {
            console.log("Invalid idtokenjwt - cannot decode");
        }
    }
    // Do we need to enforce authentication?
    if (_.get(req, '_settings.ENFORCE_VERIFIED_IDENTITY')) {
        if ( _.get(idattrs, 'verifiedIdentity',"false") != "true") {
            // identity is not verified
            // reset question to the configured no_verified_identity question
            console.log("Missing or invalid idtokenjwt - ENFORCE_VERIFIED_IDENTITY is true - seeting question to NO_VERIFIED_IDENTITY_QUESTION") ;
            req.question = _.get(req, '_settings.NO_VERIFIED_IDENTITY_QUESTION','no_verified_identity') ;
        }
    }
    if(_.get(req,'_settings.PII_REJECTION_ENABLED')){
        console.log("Checking for PII")
        console.log("Request--" + JSON.stringify(req))
        if(_.get(req,"_settings.PII_REJECTION_QUESTION")){
            if(await isPIIDetected(req.question,
                _.get(req,"_settings.PII_REJECTION_WITH_COMPREHEND"), 
                _.get(req,"_settings.PII_REJECTION_REGEX"),
                _.get(req,"_settings.PII_REJECTION_IGNORE_TYPES"))){
                console.log("Found PII or REGEX Match - setting question to PII_REJECTION_QUESTION") ;
                req.question = _.get(req, '_settings.PII_REJECTION_QUESTION') ;
            }
        }
    }else{
        console.log("Not checking for PII " + _.get(req,'_settings.PII_REJECTION_ENABLED'));
    }

    // Add _userInfo to req, from UsersTable
    // TODO Will need to rework logic if/when we link userid across clients (SMS,WebUI,Alexa)
    var userId = req._userId;
    var req_userInfo = await get_userInfo(userId, idattrs);
    _.set(req,"_userInfo", req_userInfo);
    // Add _userInfo to res, with updated timestamps
    // May be further modified by lambda hooks
    // Will be saved back to DynamoDB in userInfo.js
    var res_userInfo = await update_userInfo(userId, req_userInfo);
    _.set(res,"_userInfo", res_userInfo);
    
    // by default, remove tokens from session event to prevent accidental logging of token values
    // to keep tokens, create custom setting "REMOVE_ID_TOKENS_FROM_SESSION" and set to "false"
    if (_.get(req, '_settings.REMOVE_ID_TOKENS_FROM_SESSION',true)) {
        console.log("Removing id tokens from session event: idtokenjwt, accesstokenjwt, refreshtoken") ;
        delete req.session.idtokenjwt ;
        delete req.session.accesstokenjwt ;
        delete req.session.refreshtoken ;
        delete res.session.idtokenjwt ;
        delete res.session.accesstokenjwt ;
        delete res.session.refreshtoken ;
        // Lex
        if (req._type == "LEX") {
            if (_.get(req,"_event.sessionAttributes")) {
                delete req._event.sessionAttributes.idtokenjwt ;
                delete req._event.sessionAttributes.accesstokenjwt ;
                delete req._event.sessionAttributes.refreshtoken ;
            }
        }
        if (req._type == "ALEXA") {
            if (_.get(req,"_event.session.attributes")) {
                delete req._event.session.attributes.idtokenjwt ;
                delete req._event.session.attributes.accesstokenjwt ;
                delete req._event.session.attributes.refreshtoken ;
            }
        }
    }

    _.set(req,"_info.es.address",process.env.ES_ADDRESS)
    _.set(req,"_info.es.index",process.env.ES_INDEX)
    _.set(req,"_info.es.type",process.env.ES_TYPE)
    _.set(req,"_info.es.service.qid",process.env.ES_SERVICE_QID)
    _.set(req,"_info.es.service.proxy",process.env.ES_SERVICE_PROXY)
    
    if(process.env.LAMBDA_PREPROCESS){
        return await util.invokeLambda({
            FunctionName:process.env.LAMBDA_PREPROCESS,
            req,res
        })
    }else{
        return {req,res}
    }
}
