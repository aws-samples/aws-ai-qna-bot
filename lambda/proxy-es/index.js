var Url=require('url')
var Promise=require('bluebird')
var cfnLambda=require('cfn-lambda')
var request=require('./lib/request')

const filter = text => {
    if (process.env.CLOUDWATCHLOGGINGDISABLED === "true"){
        return "cloudwatch logging disabled";
    } else {
        if (process.env.QNAREDACT === "true") {
            let re = new RegExp(process.env.REDACTING_REGEX, "g");
            return text.replace(re, "XXXXXX");
        } else {
            return text;
        }
    }
}

require('intercept-stdout')(filter, filter);

exports.qid=require('./lib/qid')
exports.logging=require('./lib/logging')
exports.cleanmetrics=require('./lib/cleanmetrics')
exports.utterances=require('./lib/utterances')
exports.handler =require('./lib/handler') 
exports.resource=require('./lib/cfn').resource

exports.query=function(event,context,callback){
    require('./lib/query')(event.req,event.res)
    .then((x)=>callback(null,x)) 
    .catch(callback)
}

