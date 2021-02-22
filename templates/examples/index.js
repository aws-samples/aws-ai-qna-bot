var fs=require('fs')
var _=require('lodash')

var examples=require(`./examples`);
var extensions=require(`./extensions`);
var resources=Object.assign(examples,extensions);
var outputs1=require('./outputs').outputs;
var outputs2=require('./examples/responsebots').outputs;
var outputs=Object.assign(outputs1,outputs2);

module.exports={
  "Resources":resources,
  "Conditions": {},
  "AWSTemplateFormatVersion": "2010-09-09",
  "Description": "QnABot nested example resources",
  "Mappings": {},
  "Outputs": outputs,
  "Parameters": {
    "FulfillmentLambdaRole":{"Type":"String"},
    "QnAType":{"Type":"String"}, 
    "QuizType":{"Type":"String"},
    "Index":{"Type":"String"},
    "ESAddress":{"Type":"String"},
    "BootstrapBucket":{"Type":"String"},
    "BootstrapPrefix":{"Type":"String"},
    "FeedbackFirehose":{"Type":"String"},
    "FeedbackFirehoseName":{"Type":"String"},
    "CFNLambda":{"Type":"String"},
    "CFNLambdaRole":  {"Type":"String"},
    "ApiUrlName":{"Type":"String"},
    "AssetBucket":{"Type":"String"},
    "QIDLambdaArn":{"Type":"String"},
    "VPCSubnetIdList" : {"Type": "String"},
    "VPCSecurityGroupIdList": {"Type": "String"},
    "XraySetting": {"Type": "String"}
  },
   "Conditions": {
    "VPCEnabled": { "Fn::Not": [
        { "Fn::Equals": [ "", { "Ref": "VPCSecurityGroupIdList" } ] }
      ] },
    "XRAYEnabled":{"Fn::Equals":[{"Ref":"XraySetting"},"TRUE"]},
    }
  }





