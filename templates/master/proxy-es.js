var _ = require('lodash');

var examples = _.fromPairs(require('../examples/outputs')
  .names
  .map(x => {
    return [x, { "Fn::GetAtt": ["ExamplesStack", `Outputs.${x}`] }];
  }));
  
module.exports={
    "ESProxyCodeVersion":{
        "Type": "Custom::S3Version",
        "Properties": {
            "ServiceToken": { "Fn::GetAtt" : ["CFNLambda", "Arn"] },
            "Bucket": {"Ref":"BootstrapBucket"},
            "Key": {"Fn::Sub":"${BootstrapPrefix}/lambda/proxy-es.zip"},
            "BuildDate":(new Date()).toISOString()
        }
    },

    "UtteranceLambda": {
      "Type": "AWS::Lambda::Function",
      "Properties": {
        "Code": {
            "S3Bucket": {"Ref":"BootstrapBucket"},
            "S3Key": {"Fn::Sub":"${BootstrapPrefix}/lambda/proxy-es.zip"},
            "S3ObjectVersion":{"Ref":"ESProxyCodeVersion"}
        },
        "Environment": {
          "Variables": {
            ES_INDEX:{"Fn::GetAtt":["Var","QnaIndex"]},
            ES_ADDRESS:{"Fn::GetAtt":["ESVar","ESAddress"]},
            UTTERANCE_BUCKET:{"Ref":"AssetBucket"},
            UTTERANCE_KEY:"default-utterances.json",
          }
        },
        "Handler": "index.utterances",
        "MemorySize": "1408",
        "Role": {"Fn::GetAtt": ["ESProxyLambdaRole","Arn"]},
        "Runtime": "nodejs10.x",
        "Timeout": 300,
        "VpcConfig" : {
            "Fn::If": [ "VPCEnabled", {
                "SubnetIds": {"Ref": "VPCSubnetIdList"},
                "SecurityGroupIds": {"Ref": "VPCSecurityGroupIdList"}
            }, {"Ref" : "AWS::NoValue"} ]
        },
        "TracingConfig" : {
            "Fn::If": [ "XRAYEnabled", {"Mode": "Active"},
                {"Ref" : "AWS::NoValue"} ]
        },
        "Tags":[{
            Key:"Type",
            Value:"Service"
        }]
      }
    },
    "ESQidLambda": {
      "Type": "AWS::Lambda::Function",
      "Properties": {
        "Code": {
            "S3Bucket": {"Ref":"BootstrapBucket"},
            "S3Key": {"Fn::Sub":"${BootstrapPrefix}/lambda/proxy-es.zip"},
            "S3ObjectVersion":{"Ref":"ESProxyCodeVersion"}
        },
        "Environment": {
          "Variables": {
            ES_INDEX:{"Fn::GetAtt":["Var","QnaIndex"]},
            ES_ADDRESS:{"Fn::GetAtt":["ESVar","ESAddress"]}
          }
        },
        "Handler": "index.qid",
        "MemorySize": "1408",
        "Role": {"Fn::GetAtt": ["ESProxyLambdaRole","Arn"]},
        "Runtime": "nodejs10.x",
        "Timeout": 300,
        "VpcConfig" : {
            "Fn::If": [ "VPCEnabled", {
                "SubnetIds": {"Ref": "VPCSubnetIdList"},
                "SecurityGroupIds": {"Ref": "VPCSecurityGroupIdList"}
            }, {"Ref" : "AWS::NoValue"} ]
        },
        "TracingConfig" : {
            "Fn::If": [ "XRAYEnabled", {"Mode": "Active"},
                {"Ref" : "AWS::NoValue"} ]
        },
        "Tags":[{
            Key:"Type",
            Value:"Service"
        }]
      }
    },
    "ESCleaningLambda": {
      "Type": "AWS::Lambda::Function",
      "Properties": {
        "Code": {
            "S3Bucket": {"Ref":"BootstrapBucket"},
            "S3Key": {"Fn::Sub":"${BootstrapPrefix}/lambda/proxy-es.zip"},
            "S3ObjectVersion":{"Ref":"ESProxyCodeVersion"}
        },
        "Environment": {
          "Variables": {
            ES_INDEX:{"Fn::GetAtt":["Var","QnaIndex"]},
            ES_ADDRESS:{"Fn::GetAtt":["ESVar","ESAddress"]},
            FEEDBACK_DELETE_RANGE_MINUTES:43200,
            METRICS_DELETE_RANGE_MINUTES:43200,
          }
        },
        "Handler": "index.cleanmetrics",
        "MemorySize": "1408",
        "Role": {"Fn::GetAtt": ["ESProxyLambdaRole","Arn"]},
        "Runtime": "nodejs10.x",
        "Timeout": 300,
        "VpcConfig" : {
            "Fn::If": [ "VPCEnabled", {
                "SubnetIds": {"Ref": "VPCSubnetIdList"},
                "SecurityGroupIds": {"Ref": "VPCSecurityGroupIdList"}
            }, {"Ref" : "AWS::NoValue"} ]
        },
        "TracingConfig" : {
            "Fn::If": [ "XRAYEnabled", {"Mode": "Active"},
                {"Ref" : "AWS::NoValue"} ]
        },
        "Tags":[{
            Key:"Type",
            Value:"Service"
        }]
      }
    },
    "ScheduledESCleaning": {
      "Type": "AWS::Events::Rule",
      "Properties": {
        "Description": "",
        "ScheduleExpression": "rate(1 day)",
        "State": "ENABLED",
        "Targets": [{
          "Arn": { "Fn::GetAtt": ["ESCleaningLambda", "Arn"] },
          "Id": "ES_Cleaning_Function"
        }]
      }
    },
    "PermissionForEventsToInvokeLambda": {
      "Type": "AWS::Lambda::Permission",
      "Properties": {
        "FunctionName": { "Ref": "ESCleaningLambda" },
        "Action": "lambda:InvokeFunction",
        "Principal": "events.amazonaws.com",
        "SourceArn": { "Fn::GetAtt": ["ScheduledESCleaning", "Arn"] }
      }
    },
    "ESLoggingLambda": {
      "Type": "AWS::Lambda::Function",
      "Properties": {
        "Code": {
            "S3Bucket": {"Ref":"BootstrapBucket"},
            "S3Key": {"Fn::Sub":"${BootstrapPrefix}/lambda/proxy-es.zip"},
            "S3ObjectVersion":{"Ref":"ESProxyCodeVersion"}
        },
        "Environment": {
          "Variables": {
            "FIREHOSE_NAME":{"Ref":"GeneralFirehose"},
          }
        },
        "Handler": "index.logging",
        "MemorySize": "1408",
        "Role": {"Fn::GetAtt": ["ESLoggingLambdaRole","Arn"]},
        "Runtime": "nodejs10.x",
        "Timeout": 300,
        "VpcConfig" : {
            "Fn::If": [ "VPCEnabled", {
                "SubnetIds": {"Ref": "VPCSubnetIdList"},
                "SecurityGroupIds": {"Ref": "VPCSecurityGroupIdList"}
            }, {"Ref" : "AWS::NoValue"} ]
        },
        "TracingConfig" : {
            "Fn::If": [ "XRAYEnabled", {"Mode": "Active"},
                {"Ref" : "AWS::NoValue"} ]
        },
        "Tags":[{
            Key:"Type",
            Value:"Logging"
        }]
      }
    },
    "ESQueryLambda": {
      "Type": "AWS::Lambda::Function",
      "Properties": {
        "Code": {
            "S3Bucket": {"Ref":"BootstrapBucket"},
            "S3Key": {"Fn::Sub":"${BootstrapPrefix}/lambda/proxy-es.zip"},
            "S3ObjectVersion":{"Ref":"ESProxyCodeVersion"}
        },
        "Environment": {
          "Variables": Object.assign({
              DEFAULT_SETTINGS_PARAM:{"Ref":"DefaultQnABotSettings"},
              CUSTOM_SETTINGS_PARAM:{"Ref":"CustomQnABotSettings"},
          }, examples)
        },
        "Handler": "index.query",
        "MemorySize": "1408",
        "Role": {"Fn::GetAtt": ["ESProxyLambdaRole","Arn"]},
        "Runtime": "nodejs10.x",
        "Timeout": 300,
        "VpcConfig" : {
            "Fn::If": [ "VPCEnabled", {
                "SubnetIds": {"Ref": "VPCSubnetIdList"},
                "SecurityGroupIds": {"Ref": "VPCSecurityGroupIdList"}
            }, {"Ref" : "AWS::NoValue"} ]
        },
        "TracingConfig" : {
            "Fn::If": [ "XRAYEnabled", {"Mode": "Active"},
                {"Ref" : "AWS::NoValue"} ]
        },
        "Tags":[{
            Key:"Type",
            Value:"Query"
        }]
      }
    },
    "ESProxyLambda": {
      "Type": "AWS::Lambda::Function",
      "Properties": {
        "Code": {
            "S3Bucket": {"Ref":"BootstrapBucket"},
            "S3Key": {"Fn::Sub":"${BootstrapPrefix}/lambda/proxy-es.zip"},
            "S3ObjectVersion":{"Ref":"ESProxyCodeVersion"}
        },
        "Environment": {
          "Variables": {
            ES_TYPE:{"Fn::GetAtt":["Var","QnAType"]},
            ES_INDEX:{"Fn::GetAtt":["Var","QnaIndex"]},
            ES_ADDRESS:{"Fn::GetAtt":["ESVar","ESAddress"]},
            DEFAULT_SETTINGS_PARAM:{"Ref":"DefaultQnABotSettings"},
            CUSTOM_SETTINGS_PARAM:{"Ref":"CustomQnABotSettings"},
          }
        },
        "Handler": "index.handler",
        "MemorySize": "1408",
        "Role": {"Fn::GetAtt": ["ESProxyLambdaRole","Arn"]},
        "Runtime": "nodejs10.x",
        "Timeout": 300,
        "VpcConfig" : {
            "Fn::If": [ "VPCEnabled", {
                "SubnetIds": {"Ref": "VPCSubnetIdList"},
                "SecurityGroupIds": {"Ref": "VPCSecurityGroupIdList"}
            }, {"Ref" : "AWS::NoValue"} ]
        },
        "TracingConfig" : {
            "Fn::If": [ "XRAYEnabled", {"Mode": "Active"},
                {"Ref" : "AWS::NoValue"} ]
        },
        "Tags":[{
            Key:"Type",
            Value:"Service"
        }]
      }
    },
    "ESProxyLambdaRole": {
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
        "ManagedPolicyArns": [
          "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
          "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole",
          "arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess",
          "arn:aws:iam::aws:policy/TranslateReadOnly",
          {"Ref":"QueryPolicy"},
          "arn:aws:iam::aws:policy/AmazonLexFullAccess"
        ],
        "Policies": [
          {
          	"PolicyName": "ParamStorePolicy",
          	"PolicyDocument": {
          		"Version": "2012-10-17",
          		"Statement": [{
          			"Effect": "Allow",
          			"Action": ["ssm:GetParameter","ssm:GetParameters"],
          			"Resource": "*"
          		}]
          	}
          },
          {
            "PolicyName": "LambdaInvokePolicy",
            "PolicyDocument": {
                "Version": "2012-10-17",
                "Statement": [{
                    "Effect": "Allow",
                    "Action": ["lambda:InvokeFunction"],
                    "Resource": [
                        "arn:aws:lambda:*:*:function:qna*",
                        "arn:aws:lambda:*:*:function:QNA*"
                    ]
                }]
            }
          },
        { 
          "PolicyName" : "S3QNABucketReadAccess",
          "PolicyDocument" : {
          "Version": "2012-10-17",
            "Statement": [
              {
                  "Effect": "Allow",
                  "Action": [
                      "s3:GetObject"
                   ],   
                  "Resource": [
                      "arn:aws:s3:::QNA*/*",
                      "arn:aws:s3:::qna*/*"
                  ]
              }
            ]
          }
        }
        ]
      }
    },
    "ESLoggingLambdaRole": {
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
          "PolicyName" : "LambdaGeneralFirehoseQNALambda",
          "PolicyDocument" : {
          "Version": "2012-10-17",
            "Statement": [
                {
                  "Effect": "Allow",
                  "Action": [
                    "lambda:InvokeFunction"
                  ],
                  "Resource": [
                    {"Fn::Join": ["",["arn:aws:lambda:",{ "Ref" : "AWS::Region" },":",{ "Ref" : "AWS::AccountId" },":function:qna-*"]]},
                    {"Fn::Join": ["",["arn:aws:lambda:",{ "Ref" : "AWS::Region" },":",{ "Ref" : "AWS::AccountId" },":function:QNA-*"]]},
                  ]
                },
                {
                  "Effect": "Allow",
                  "Action": [
                    "firehose:PutRecord",
                    "firehose:PutRecordBatch"
                  ],
                  "Resource": [
                    {"Fn::GetAtt" : ["GeneralFirehose", "Arn"]}
                  ]
                }
            ]
          }
        }],
        "ManagedPolicyArns": [
          "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
          "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole",
          "arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess",
        ]
      }
    },
    "QueryPolicy": {
      "Type": "AWS::IAM::ManagedPolicy",
      "Properties": {
        "PolicyDocument": {
          "Version": "2012-10-17",
          "Statement": [
            {
              "Effect": "Allow",
              "Action": [
                "es:*"
              ],
              "Resource":["*"]
            },{
              "Effect": "Allow",
              "Action": [
                "kendra:Query"
              ],
              "Resource":[
                {"Fn::Sub":"arn:aws:kendra:${AWS::Region}:${AWS::AccountId}:index/*"},
              ]
            },{
                "Effect": "Allow",
                "Action": ["s3:Get*"],
                "Resource":[
                    {"Fn::Sub":"arn:aws:s3:::${AssetBucket}*"}
                ]
            },
            {
              "Effect": "Allow",
              "Action": ["comprehend:DetectSyntax"],
              "Resource":["*"]
            }
          ]
        }
      }
    }
}

