var fs=require('fs')
var _=require('lodash')
var fs=require('fs')

var js=fs.readdirSync(`${__dirname}/js_lambda_hooks`)
.map(name=>{
    return {
        name:`EXT${name}`,
        resource:jslambda(name),
        codeVersionName:`CodeVersion${name}`,
        codeVersionResource:codeVersion(name),
        id:`${name}JS`,
    }
})

var py=fs.readdirSync(`${__dirname}/py_lambda_hooks`)
.map(name=>{
    return {
        name:`EXT${name}`,
        resource:pylambda(name),
        codeVersionName:`CodeVersion${name}`,
        codeVersionResource:codeVersion(name),
        id:`${name}PY`,
    }
})

var lambda_hooks=js.concat(py) ;

module.exports=Object.assign(
    _.fromPairs(lambda_hooks.map(x=>[x.name,x.resource])),
    _.fromPairs(lambda_hooks.map(x=>[x.codeVersionName,x.codeVersionResource])),
    {
    "EXTUiImport":{
        "Type": "Custom::ExtensionsUiImport",
        "Properties": Object.assign(
            _.fromPairs(lambda_hooks.map(x=>[x.id,{"Ref":x.name}]))
        ,{
            "ServiceToken": { "Fn::GetAtt" : ["EXTUiImportLambda", "Arn"] },
            "photos":{"Fn::Sub":"${ApiUrlName}/examples/photos"},
            "Bucket": {"Ref":"AssetBucket"},
            "version":{"Ref":"EXTUiImportVersion"}
        })
    },
    "EXTUiImportLambda":{
      "Type": "AWS::Lambda::Function",
      "Properties": {
        "Code": {
            "S3Bucket": {"Ref":"BootstrapBucket"},
            "S3Key": {"Fn::Join":["",[
                {"Ref":"BootstrapPrefix"},
                "/lambda/EXTUiImports.zip"
            ]]},
            "S3ObjectVersion":{"Ref":"EXTUiImportVersion"}
        },
        "Handler": "ui_import.handler",
        "MemorySize": "128",
        "Role":{"Ref":"CFNLambdaRole"} ,
        "Runtime": "nodejs10.x",
        "Timeout": 300,
        "VpcConfig" : {
            "Fn::If": [ "VPCEnabled", {
                "SubnetIds": { "Fn::Split" : [ ",", {"Ref": "VPCSubnetIdList"} ] },
                "SecurityGroupIds": { "Fn::Split" : [ ",", {"Ref": "VPCSecurityGroupIdList"} ] },
            }, {"Ref" : "AWS::NoValue"} ]
        },
        "TracingConfig" : {
            "Fn::If": [ "XRAYEnabled", {"Mode": "Active"},
                {"Ref" : "AWS::NoValue"} ]
        },
        "Tags":[{
            Key:"Type",
            Value:"CustomResource"
        }]
      }
    },
    "EXTUiImportVersion": {
      "Type": "Custom::S3Version",
      "Properties": {
          "ServiceToken": {"Ref":"CFNLambda"},
          "Bucket": {"Ref":"BootstrapBucket"},
          "Key": {"Fn::Sub":"${BootstrapPrefix}/lambda/EXTUiImports.zip"},
          "BuildDate":(new Date()).toISOString()
      }
    },
    "ExtensionsInvokePolicy": {
      "Type": "AWS::IAM::ManagedPolicy",
      "Properties": {
        "PolicyDocument": {
          "Version": "2012-10-17",
          "Statement": [{
              "Effect": "Allow",
              "Action": [
                "lambda:InvokeFunction"
              ],
              "Resource":lambda_hooks
                .map(x=>{ return {"Fn::GetAtt":[x.name,"Arn"]}})
            }]
        },
        "Roles": [{"Ref": "FulfillmentLambdaRole"}]
      }
    },
    "ExtensionLambdaRole":{
      "Type": "AWS::IAM::Role",
      "Properties": {
        "AssumeRolePolicyDocument": {
          "Version": "2012-10-17",
          "Statement": [
            {
              "Effect": "Allow",
              "Principal": {
                "Service": "lambda.amazonaws.com"
              },
              "Action": "sts:AssumeRole"
            }
          ]
        },
        "Path": "/",
        "Policies":[{ 
          "PolicyName" : "LambdaFeedbackFirehoseQNALambda",
          "PolicyDocument" : {
          "Version": "2012-10-17",
            "Statement": [
                {
                  "Effect": "Allow",
                  "Action": [
        						"kms:Encrypt",
        						"kms:Decrypt",
        					], 
        					"Resource":{"Fn::GetAtt":["QuizKey","Arn"]}
                },
                {
                  "Effect": "Allow",
                  "Action": [
                    "lambda:InvokeFunction"
                  ],
                  "Resource": [
                    {"Fn::Join": ["",["arn:aws:lambda:",{ "Ref" : "AWS::Region" },":",{ "Ref" : "AWS::AccountId" },":function:qna-*"]]},
                    {"Fn::Join": ["",["arn:aws:lambda:",{ "Ref" : "AWS::Region" },":",{ "Ref" : "AWS::AccountId" },":function:QNA-*"]]},
                    {"Ref":"QIDLambdaArn"} 
                  ]
                },
                {
                  "Effect": "Allow",
                  "Action": [
                    "firehose:PutRecord",
                    "firehose:PutRecordBatch"
                  ],
                  "Resource": [
                    {"Ref":"FeedbackFirehose"}
                  ]
                }
            ]
          }
        },
        { 
          "PolicyName" : "LexQNALambda",
          "PolicyDocument" : {
          "Version": "2012-10-17",
            "Statement": [
              {
                  "Effect": "Allow",
                  "Action": [
                      "lex:PostText"
                   ],   
                  "Resource": [
                      {"Fn::Join": ["",["arn:aws:lex:",{ "Ref" : "AWS::Region" },":",{ "Ref" : "AWS::AccountId" },":bot:*",":qna*"]]},
                      {"Fn::Join": ["",["arn:aws:lex:",{ "Ref" : "AWS::Region" },":",{ "Ref" : "AWS::AccountId" },":bot:*",":QNA*"]]},
                  ]
              }
            ]
          }
        }],
        "ManagedPolicyArns": [
            "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
            "arn:aws:iam::aws:policy/TranslateReadOnly",
            "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole",
            "arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess",
            "arn:aws:iam::aws:policy/AmazonKendraReadOnlyAccess"]
      }
    }
});
function jslambda(name){
  return {
    "Type": "AWS::Lambda::Function",
    "Properties": {
      "Code": {
          "S3Bucket": {"Ref":"BootstrapBucket"},
          "S3Key": {"Fn::Join":["",[
              {"Ref":"BootstrapPrefix"},
              `/lambda/EXT${name}.zip`
          ]]},
          "S3ObjectVersion":{"Ref":`CodeVersion${name}`}
      },
      "Environment": {
        "Variables": {
          "ES_QNA_TYPE": {"Ref":"QnAType"},
          "ES_QUIZE_TYPE": {"Ref":"QuizType"},
          "ES_INDEX": {"Ref":"Index"},
          "FIREHOSE_NAME":{"Ref":"FeedbackFirehoseName"},
          "ES_ADDRESS": {"Ref":"ESAddress"},
          "QUIZ_KMS_KEY":{"Ref":"QuizKey"}
        }
      },
      "Handler":`${name}.handler`,
      "MemorySize": "2048",
      "Role": {"Fn::GetAtt": ["ExtensionLambdaRole","Arn"]},
      "Runtime": "nodejs10.x",
      "Timeout": 300,
      "VpcConfig" : {
          "Fn::If": [ "VPCEnabled", {
              "SubnetIds": { "Fn::Split" : [ ",", {"Ref": "VPCSubnetIdList"} ] },
              "SecurityGroupIds": { "Fn::Split" : [ ",", {"Ref": "VPCSecurityGroupIdList"} ] },
          }, {"Ref" : "AWS::NoValue"} ]
      },
      "TracingConfig" : {
          "Fn::If": [ "XRAYEnabled", {"Mode": "Active"},
              {"Ref" : "AWS::NoValue"} ]
      },
            "Tags":[{
          Key:"Type",
          Value:"LambdaHook"
      }]
    }
  }
}
function pylambda(name){
  return {
    "Type": "AWS::Lambda::Function",
    "Properties": {
      "Code": {
          "S3Bucket": {"Ref":"BootstrapBucket"},
          "S3Key": {"Fn::Join":["",[
              {"Ref":"BootstrapPrefix"},
              `/lambda/EXT${name}.zip`
          ]]},
          "S3ObjectVersion":{"Ref":`CodeVersion${name}`}
      },
      "Environment": {
        "Variables": {
          "ES_QNA_TYPE": {"Ref":"QnAType"},
          "ES_QUIZE_TYPE": {"Ref":"QuizType"},
          "ES_INDEX": {"Ref":"Index"},
          "FIREHOSE_NAME":{"Ref":"FeedbackFirehoseName"},
          "ES_ADDRESS": {"Ref":"ESAddress"},
          "QUIZ_KMS_KEY":{"Ref":"QuizKey"},
          "PYTHONPATH":"/var/task/py_modules:/var/runtime:/opt/python"
        }
      },
      "Handler":`${name}.handler`,
      "MemorySize": "2048",
      "Role": {"Fn::GetAtt": ["ExtensionLambdaRole","Arn"]},
      "Runtime": "python3.6",
      "Timeout": 300,
      "VpcConfig" : {
        "Fn::If": [ "VPCEnabled", {
            "SubnetIds": { "Fn::Split" : [ ",", {"Ref": "VPCSubnetIdList"} ] },
            "SecurityGroupIds": { "Fn::Split" : [ ",", {"Ref": "VPCSecurityGroupIdList"} ] },
        }, {"Ref" : "AWS::NoValue"} ]
    },
    "TracingConfig" : {
        "Fn::If": [ "XRAYEnabled", {"Mode": "Active"},
            {"Ref" : "AWS::NoValue"} ]
    },
      "Tags":[{
          Key:"Type",
          Value:"LambdaHook"
      }]
    }
  }
}

function codeVersion(name){
  return {
    "Type": "Custom::S3Version",
    "Properties": {
        "ServiceToken": {"Ref":"CFNLambda"},
        "Bucket": {"Ref":"BootstrapBucket"},
        "Key": {"Fn::Sub":"${BootstrapPrefix}/lambda/EXT" + name + ".zip"},
        "BuildDate":(new Date()).toISOString()
    }
  }
}
