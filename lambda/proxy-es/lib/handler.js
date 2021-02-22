var Url=require('url');
var Promise=require('bluebird');
var request=require('./request');
var _=require('lodash');
var build_es_query=require('./esbodybuilder');
var kendra = require('./kendraQuery');
var AWS=require('aws-sdk');


function isJson(str) {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}

function str2bool(settings) {
    var new_settings = _.mapValues(settings, x => {
        if (_.isString(x)) {
            x = x.replace(/^"(.+)"$/,'$1');  // remove wrapping quotes
            if (x.toLowerCase() === "true") {
                return true ;
            }
            if (x.toLowerCase() === "false") {
                return false ;
            }
        }
        return x;
    });
    return new_settings;
}

async function get_parameter(param_name) {
    var ssm = new AWS.SSM();
    var params = {
        Name: param_name,
        WithDecryption: true
    };
    var response = await ssm.getParameter(params).promise();
    var settings = response.Parameter.Value
    if (isJson(settings)) {
        settings = JSON.parse(response.Parameter.Value);
        settings = str2bool(settings) ;
    }
    return settings;
}

async function get_settings() {
    var default_settings_param = process.env.DEFAULT_SETTINGS_PARAM;
    var custom_settings_param = process.env.CUSTOM_SETTINGS_PARAM;

    console.log("Getting Default QnABot settings from SSM Parameter Store: ", default_settings_param);
    var default_settings = await get_parameter(default_settings_param);

    console.log("Getting Custom QnABot settings from SSM Parameter Store: ", custom_settings_param);
    var custom_settings = await get_parameter(custom_settings_param);

    var settings = _.merge(default_settings, custom_settings);

    console.log("Merged Settings: ", settings);

    if (settings.ENABLE_REDACTING) {
        console.log("redacting enabled");
        process.env.QNAREDACT="true";
        process.env.REDACTING_REGEX=settings.REDACTING_REGEX;
    } else {
        console.log("redacting disabled");
        process.env.QNAREDACT="false";
        process.env.REDACTING_REGEX="";
    }
    return settings;
}


async function get_es_query(event, settings) {
    var question = _.get(event,'question','');
    if (question.length > 0) {
        var query_params = {
            question: question,
            topic: _.get(event,'topic',''),
            from: _.get(event,'from',0),
            size: _.get(event,'size',1),
            minimum_should_match: _.get(settings,'ES_MINIMUM_SHOULD_MATCH'),
            phrase_boost: _.get(settings, 'ES_PHRASE_BOOST'),
            use_keyword_filters: _.get(settings,'ES_USE_KEYWORD_FILTERS'),
            keyword_syntax_types: _.get(settings,'ES_KEYWORD_SYNTAX_TYPES'),
            syntax_confidence_limit: _.get(settings,'ES_SYNTAX_CONFIDENCE_LIMIT'),
            score_answer_field: _.get(settings,'ES_SCORE_ANSWER_FIELD'),
            fuzziness: _.get(settings, 'ES_USE_FUZZY_MATCH'),
            es_expand_contractions: _.get(settings,"ES_EXPAND_CONTRACTIONS")

        };
        return build_es_query(query_params);
    } else {
        return Promise.resolve(event.body);
    }
}



async function run_query_es(event, settings) {
    console.log("ElasticSearch Query",JSON.stringify(es_query,null,2));
    var es_query = await get_es_query(event, settings);
    var es_response = await request({
        url:Url.resolve("https://"+event.endpoint,event.path),
        method:event.method,
        headers:event.headers,
        body:es_query 
    });
    return es_response;
}


async function run_query_kendra(event, kendra_index) {
    console.log("Kendra FAQ Query index:" + kendra_index);
    var request_params = {
        kendra_faq_index:kendra_index,
        question:event.question,
        size:10, // limit kendra hits to 10 max to avoid pagination issues
        es_address: event.endpoint,
        es_path: event.path,
    } ;
    var kendra_response = await kendra.handler(request_params);
    return kendra_response;
}


module.exports= async (event, context, callback) => {
    console.log('Received event:', JSON.stringify(event, null, 2));
    try {
        var settings = await get_settings();
        var kendra_index = _.get(settings, "KENDRA_FAQ_INDEX")

        var question = _.get(event,'question','');
        var topic = _.get(event,'topic','');
        let okKendraQuery = (question.length > 0 && topic.length == 0 && kendra_index != "") ;
        if ( okKendraQuery ) {
            var response = await run_query_kendra(event, kendra_index);
            // ES fallback if KendraFAQ fails
            var hit = _.get(response, "hits.hits[0]._source");
            if (!hit && _.get(settings, 'KENDRA_FAQ_ES_FALLBACK', false)){
                console.log("ES Fallback");
                response = await run_query_es(event, settings);
            }
        } else {
            var response = await run_query_es(event, settings);
        }
        
        console.log("Query response: ", JSON.stringify(response,null,2));
        return callback(null, response);
    } catch (error) {
        console.log(`error is ${JSON.stringify(error, null,2)}`);
        return callback(JSON.stringify({
            type:error.response.status===404 ? "[NotFound]":"[InternalServiceError]",
            status:error.response.status,
            message:error.response.statusText,
            data:error.response.data
        }))
    }
}
