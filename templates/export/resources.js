var fs=require('fs')
var _=require('lodash')

var files=fs.readdirSync(`${__dirname}`)
    .filter(x=>!x.match(/README.md|Makefile|index|test|outputs|.DS_Store/))
    .map(x=>require(`./${x}`))

module.exports=Object.assign(
    {
    "ExportCodeVersion":{
        "Type": "Custom::S3Version",
        "Properties": {
            "ServiceToken": { "Ref" : "CFNLambda" },
            "Bucket": {"Ref":"BootstrapBucket"},
            "Key": {"Fn::Sub":"${BootstrapPrefix}/lambda/export.zip"},
            "BuildDate":(new Date()).toISOString()
        }
    },
    "ConnectCodeVersion":{
          "Type": "Custom::S3Version",
          "Properties": {
              "ServiceToken": { "Ref" : "CFNLambda" },
              "Bucket": {"Ref":"BootstrapBucket"},
              "Key": {"Fn::Sub":"${BootstrapPrefix}/lambda/connect.zip"},
              "BuildDate":(new Date()).toISOString()
          }
      },
      "ConnectLambda": {
        "Type": "AWS::Lambda::Function",
        "Properties": {
          "Code": {
              "S3Bucket": {"Ref":"BootstrapBucket"},
              "S3Key": {"Fn::Sub":"${BootstrapPrefix}/lambda/connect.zip"},
              "S3ObjectVersion":{"Ref":"ConnectCodeVersion"}
          },
          "Environment": {
              "Variables": {
                fallBackIntent:{"Ref":"FallbackIntent"},
                intent:{"Ref":"Intent"},
                lexBot:{"Ref":"BotName"},
                outputBucket:{"Ref":"ExportBucket"},
                s3Prefix:"connect/"
              }
          },
          "Handler": "index.handler",
          "MemorySize": "1024",
          "Role": {"Fn::GetAtt": ["ExportRole","Arn"]},
          "Runtime": "nodejs10.x",
          "Timeout": 300,
          "VpcConfig" : {
              "Fn::If": [ "VPCEnabled", {
                  "SubnetIds": { "Fn::Split" : [ ",", {"Ref": "VPCSubnetIdList"} ] },
                  "SecurityGroupIds": { "Fn::Split" : [ ",", {"Ref": "VPCSecurityGroupIdList"} ] },
              }, {"Ref" : "AWS::NoValue"} ]
          },
          "TracingConfig" : {
              "Fn::If": [ "XRAYEnabled", {"Mode": "Active"}, {"Ref" : "AWS::NoValue"} ]
          },
          "Tags":[{
              Key:"Type",
              Value:"Export"
          }]
        }
      },
      "ConnectApiResource": {
        "Type": "AWS::ApiGateway::Resource",
        "Properties": {
          "ParentId": {"Ref": "ApiRootResourceId"},
          "PathPart": "connect",
          "RestApiId": {"Ref": "Api"}
        }
      },
      "InvokePermissionConnectLambda": {
        "Type": "AWS::Lambda::Permission",
        "Properties": {
          "Action": "lambda:InvokeFunction",
          "FunctionName": {"Fn::GetAtt": ["ConnectLambda", "Arn"]},
          "Principal": "apigateway.amazonaws.com"
        }
      },
      Deployment: {
        Type: "Custom::ApiDeployment",
        DeletionPolicy: "Retain",
        DependsOn: [
          "ConnectGet",
          "ConnectApiResource",
          "InvokePermissionConnectLambda",
          "TranslatePost",
          "TranslateApiResource",
          "TranslateApiRootResource",
          "KendraCrawlerPost",
          "KendraCrawlerApiResource",
          "KendraCrawlerStatusRootApiResource",
          "InvokePermissionTranslateLambda",
            "KendraCrawlerStatusGet"
        ],
        Properties: {
          ServiceToken: { Ref: "CFNLambda" },
          restApiId: { Ref: "Api" },
          buildDate: new Date(),
          stage: "prod",
          ApiDeploymentId: { Ref: "ApiDeploymentId" },
          Encryption: { Ref: "Encryption" },
        },
      },
      "ConnectGet": {
        "Type": "AWS::ApiGateway::Method",
        "Properties": {
          "AuthorizationType": "AWS_IAM",
          "HttpMethod": "GET",
          "RestApiId": {"Ref": "Api"},
          "ResourceId": {"Ref": "ConnectApiResource"},
          "Integration": {
            "Type": "AWS",
            "IntegrationHttpMethod": "POST",
            "Uri": {
              "Fn::Join": [
                "",
                [
                  "arn:aws:apigateway:",
                  {"Ref": "AWS::Region"},
                  ":lambda:path/2015-03-31/functions/",
                  {"Fn::GetAtt": ["ConnectLambda", "Arn"]},
                  "/invocations"
                ]
              ]
            },
            "IntegrationResponses": [
               {
                  "StatusCode": 200
               }
            ]
         },
         "MethodResponses": [
            {
               "StatusCode": 200
            }
         ],
        }
      },
    "SyncCodeVersion":{
        "Type": "Custom::S3Version",
        "Properties": {
            "ServiceToken": { "Ref" : "CFNLambda" },
            "Bucket": {"Ref":"BootstrapBucket"},
            "Key": {"Fn::Sub":"${BootstrapPrefix}/lambda/export.zip"},
            "BuildDate":(new Date()).toISOString()
        }
    },
    "ExportStepLambda": {
      "Type": "AWS::Lambda::Function",
      "Properties": {
        "Code": {
            "S3Bucket": {"Ref":"BootstrapBucket"},
            "S3Key": {"Fn::Sub":"${BootstrapPrefix}/lambda/export.zip"},
            "S3ObjectVersion":{"Ref":"ExportCodeVersion"}
        },
        "Environment": {
            "Variables": {
                ES_INDEX:{"Ref":"VarIndex"},
                ES_ENDPOINT:{"Ref":"EsEndpoint"},
                ES_PROXY:{"Ref":"EsProxyLambda"}
            }
        },
        "Handler": "index.step",
        "MemorySize": "1024",
        "Role": {"Fn::GetAtt": ["ExportRole","Arn"]},
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
            Value:"Export"
        }]
      }
    },
    "ExportRole": {
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
          {"Ref":"ExportPolicy"}
        ]
      }
    },
    "ExportPolicy": {
      "Type": "AWS::IAM::ManagedPolicy",
      "Properties": {
        "PolicyDocument": {
          "Version": "2012-10-17",
          "Statement": [{
              "Effect": "Allow",
              "Action": [
                "s3:*"
              ],
              "Resource":[{"Fn::Sub":"arn:aws:s3:::${ExportBucket}*"}]
          },{
              "Effect": "Allow",
              "Action": [
                "lambda:InvokeFunction"
              ],
              "Resource":[{"Ref":"EsProxyLambda"}]
          }]
        }
      }
    },
    "ExportClear":{
        "Type": "Custom::S3Clear",
        "Properties": {
            "ServiceToken": { "Ref" : "CFNLambda" },
            "Bucket":{"Ref":"ExportBucket"}
        }
    },
    "KendraSyncLambda": {
        "Type": "AWS::Lambda::Function",
        "Properties": {
            "Code": {
                "S3Bucket": {"Ref":"BootstrapBucket"},
                "S3Key": {"Fn::Sub":"${BootstrapPrefix}/lambda/export.zip"},
                "S3ObjectVersion":{"Ref":"SyncCodeVersion"}
            },
            "Environment": {
                "Variables": {
                    "DEFAULT_SETTINGS_PARAM":{"Ref":"DefaultQnABotSettings"},
                    "CUSTOM_SETTINGS_PARAM":{"Ref":"CustomQnABotSettings"},
                    "OUTPUT_S3_BUCKET":{"Ref":"ExportBucket"},
                    "KENDRA_ROLE":{"Fn::GetAtt": ["KendraS3Role","Arn"]},
                    "REGION":{"Ref":"AWS::Region"}
                }
            },
            "Handler": "kendraSync.performSync",
            "MemorySize": "1024",
            "Role": {"Fn::GetAtt": ["KendraSyncRole","Arn"]},
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
                Value:"Sync"
            }]
        }
    },
    "KendraSyncRole": {
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
            },{
              "Effect": "Allow",
              "Principal": {
                "Service": "kendra.amazonaws.com"
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
          {"Ref":"KendraSyncPolicy"}
        ]
      }
    },
    "KendraSyncPolicy": {
      "Type": "AWS::IAM::ManagedPolicy",
      "Properties": {
        "PolicyDocument": {
        "Version": "2012-10-17",
        // TODO: split the statements up
        "Statement": [{
          "Effect": "Allow",
          "Action": [
              "s3:PutObject",
              "s3:Get*",
              "s3:List*",
              "kendra:CreateFaq",
              "kendra:ListFaqs",
              "kendra:TagResource",
              "kendra:DeleteFaq",
              "kendra:DescribeFaq",
              "iam:passRole",
              "ssm:getParameter"
            ],
            "Resource": [
                {"Fn::Sub":"arn:aws:kendra:${AWS::Region}:${AWS::AccountId}:index/*"},
                {"Fn::Sub":"arn:aws:kendra:${AWS::Region}:${AWS::AccountId}:index/*/faq/*"},
                {"Fn::Sub":"arn:aws:s3:::${ExportBucket}"},
                {"Fn::Sub":"arn:aws:s3:::${ExportBucket}/*"},
                {"Fn::GetAtt": ["KendraS3Role","Arn"]},
                {"Fn::Sub":"arn:aws:ssm:${AWS::Region}:${AWS::AccountId}:*"}
            ]
          }]
        }
      }
    },
    "KendraS3Role": {
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
            },{
              "Effect": "Allow",
              "Principal": {
                "Service": "kendra.amazonaws.com"
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
          {"Ref":"KendraS3Policy"}
        ]
      }
    },
    TranslateCodeVersion: {
      Type: "Custom::S3Version",
      Properties: {
        ServiceToken: { Ref: "CFNLambda" },
        Bucket: { Ref: "BootstrapBucket" },
        Key: { "Fn::Sub": "${BootstrapPrefix}/lambda/translate.zip" },
        BuildDate: new Date().toISOString(),
      },
    },
    TranslatePost: {
      Type: "AWS::ApiGateway::Method",
      Properties: {
        AuthorizationType: "AWS_IAM",
        HttpMethod: "POST",
        RestApiId: { Ref: "Api" },
        ResourceId: { Ref: "TranslateApiResource" },
        Integration: {
          Type: "AWS_PROXY",
          IntegrationHttpMethod: "POST",
          RequestTemplates: {
            "application/x-www-form-urlencoded": "{\"body\":$input.json('$')}",
          },
          Uri: {
            "Fn::Join": [
              "",
              [
                "arn:aws:apigateway:",
                { Ref: "AWS::Region" },
                ":lambda:path/2015-03-31/functions/",
                { "Fn::GetAtt": ["TranslateLambda", "Arn"] },
                "/invocations",
              ],
            ],
          },
          IntegrationResponses: [
            {
              StatusCode: 200,
            },
          ],
        },
        MethodResponses: [
          {
            StatusCode: 200,
          },
        ],
      },
    },  
    TranslateApiRootResource: {
      Type: "AWS::ApiGateway::Resource",
      Properties: {
        ParentId: { Ref: "ApiRootResourceId" },
        PathPart: "translate",
        RestApiId: { Ref: "Api" },
      },
    },
    TranslateApiResource: {
      Type: "AWS::ApiGateway::Resource",
      Properties: {
        ParentId: { Ref: "TranslateApiRootResource" },
        PathPart: "{proxy+}",
        RestApiId: { Ref: "Api" },
      },
    },
    TranslateLambda: {
      Type: "AWS::Lambda::Function",
      Properties: {
        Code: {
          S3Bucket: { Ref: "BootstrapBucket" },
          S3Key: { "Fn::Sub": "${BootstrapPrefix}/lambda/translate.zip" },
          S3ObjectVersion: { Ref: "TranslateCodeVersion" },
        },
        Environment: {
          Variables: {
            outputBucket: { Ref: "ExportBucket" },
          },
        },
        Handler: "index.handler",
        MemorySize: "1024",
        Role: { "Fn::GetAtt": ["TranslateRole", "Arn"] },
        Runtime: "nodejs10.x",
        Timeout: 300,
        "VpcConfig": {
          "Fn::If": [
            "VPCEnabled",
            {
              "SubnetIds": {"Ref": "VPCSubnetIdList"},
              "SecurityGroupIds": {"Ref": "VPCSecurityGroupIdList"}
            },
            {"Ref": "AWS::NoValue"}
          ]
        },
        "TracingConfig": {
          "Fn::If": ["XRAYEnabled", {"Mode": "Active"}, {"Ref": "AWS::NoValue"}]
        },
        Tags: [
          {
            Key: "Type",
            Value: "Export",
          },
        ],
      },
    },
    TranslateRole: {
      Type: "AWS::IAM::Role",
      Properties: {
        AssumeRolePolicyDocument: {
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Principal: {
                Service: "lambda.amazonaws.com",
              },
              Action: "sts:AssumeRole",
            },
          ],
        },
        Path: "/",
        ManagedPolicyArns: [
          "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
          { Ref: "TranslatePolicy" },
        ],
      },
    },
    TranslateCodeVersion: {
      Type: "Custom::S3Version",
      Properties: {
        ServiceToken: { Ref: "CFNLambda" },
        Bucket: { Ref: "BootstrapBucket" },
        Key: { "Fn::Sub": "${BootstrapPrefix}/lambda/translate.zip" },
        BuildDate: new Date().toISOString(),
      },
    },
    TranslateLambda: {
      Type: "AWS::Lambda::Function",
      Properties: {
        Code: {
          S3Bucket: { Ref: "BootstrapBucket" },
          S3Key: { "Fn::Sub": "${BootstrapPrefix}/lambda/translate.zip" },
          S3ObjectVersion: { Ref: "TranslateCodeVersion" },
        },
        Environment: {
          Variables: {
            outputBucket: { Ref: "ExportBucket" },
          },
        },
        Handler: "index.handler",
        MemorySize: "1024",
        Role: { "Fn::GetAtt": ["TranslateRole", "Arn"] },
        Runtime: "nodejs10.x",
        Timeout: 300,
        "VpcConfig": {
          "Fn::If": [
            "VPCEnabled",
            {
              "SubnetIds": {"Ref": "VPCSubnetIdList"},
              "SecurityGroupIds": {"Ref": "VPCSecurityGroupIdList"}
            },
            {"Ref": "AWS::NoValue"}
          ]
        },
        "TracingConfig": {
          "Fn::If": ["XRAYEnabled", {"Mode": "Active"}, {"Ref": "AWS::NoValue"}]
        },
        Tags: [
          {
            Key: "Type",
            Value: "Export",
          },
        ],
      },
    },  
    TranslatePolicy: {
      Type: "AWS::IAM::ManagedPolicy",
      Properties: {
        PolicyDocument: {
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Action: [
                "translate:ImportTerminology",
                "translate:ListTerminologies",
              ],
              Resource: ["*"],
            },
          ],
        },
      },
    },
    TranslateApiRootResource: {
      Type: "AWS::ApiGateway::Resource",
      Properties: {
        ParentId: { Ref: "ApiRootResourceId" },
        PathPart: "translate",
        RestApiId: { Ref: "Api" },
      },
    },
    TranslateApiResource: {
      Type: "AWS::ApiGateway::Resource",
      Properties: {
        ParentId: { Ref: "TranslateApiRootResource" },
        PathPart: "{proxy+}",
        RestApiId: { Ref: "Api" },
      },
    },
    InvokePermissionTranslateLambda: {
      Type: "AWS::Lambda::Permission",
      Properties: {
        Action: "lambda:InvokeFunction",
        FunctionName: { "Fn::GetAtt": ["TranslateLambda", "Arn"] },
        Principal: "apigateway.amazonaws.com",
      },
    },  
    KendraCodeVersion: {
      Type: "Custom::S3Version",
      Properties: {
        ServiceToken: { Ref: "CFNLambda" },
        Bucket: { Ref: "BootstrapBucket" },
        Key: { "Fn::Sub": "${BootstrapPrefix}/lambda/kendra-crawler.zip" },
        BuildDate: new Date().toISOString(),
      },
    },
    KendraCrawlerApiRootResource: {
      Type: "AWS::ApiGateway::Resource",
      Properties: {
        ParentId: { Ref: "ApiRootResourceId" },
        PathPart: "crawler",
        RestApiId: { Ref: "Api" },
      },
    },
    KendraCrawlerApiResource: {
      Type: "AWS::ApiGateway::Resource",
      Properties: {
        ParentId: { Ref: "KendraCrawlerApiRootResource" },
        PathPart: "start",
        RestApiId: { Ref: "Api" },
      },
    },
    KendraCrawlerStatusGet: {
      Type: "AWS::ApiGateway::Method",
      Properties: {
        AuthorizationType: "AWS_IAM",
        HttpMethod: "POST",
        RestApiId: { Ref: "Api" },
        ResourceId: { Ref: "KendraCrawlerStatusRootApiResource" },
        Integration: {
          Type: "AWS_PROXY",
          IntegrationHttpMethod: "POST",
          Uri: {
            "Fn::Join": [
              "",
              [
                "arn:aws:apigateway:",
                { Ref: "AWS::Region" },
                ":lambda:path/2015-03-31/functions/",
                { "Fn::GetAtt": ["KendraCrawlerLambda", "Arn"] },
                "/invocations",
              ],
            ],
          },
          IntegrationResponses: [
            {
              StatusCode: 200,
            },
          ],
        },
        MethodResponses: [
          {
            StatusCode: 200,
          },
        ],
      },
    },
    InvokePermissionKendraCrawlerStatusGetLambda: {
      Type: "AWS::Lambda::Permission",
      Properties: {
        Action: "lambda:InvokeFunction",
        FunctionName: { "Fn::GetAtt": ["KendraCrawlerLambda", "Arn"] },
        Principal: "apigateway.amazonaws.com",
      },
    },
    KendraSnsLambdaSubscription:
    {
      "Type" : "AWS::SNS::Subscription",
      "Properties" : {
          "Endpoint" : {"Fn::GetAtt":["KendraCrawlerLambda","Arn"]},
          "Protocol" : "lambda",
          "TopicArn" : {"Ref":"KendraCrawlerSnsTopic"}
        }
    },
    KendraTopicApiGateRole: {
      Type: "AWS::IAM::Role",
      Properties: {
        AssumeRolePolicyDocument: {
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Principal: {
                Service: ["apigateway.amazonaws.com"],
              },
              Action: ["sts:AssumeRole"],
            },
          ],
        },
        Path: "/",
        Policies: [
          {
            PolicyName: "GatewayRolePolicy",
            PolicyDocument: {
              Version: "2012-10-17",
              Statement: [
                {
                  Effect: "Allow",
                  Action: ["sns:Publish"],
                  Resource: { Ref: "KendraCrawlerSnsTopic" },
                },
                {
                  Effect: "Allow",
                  Action: [
                    "logs:PutLogEvents",
                    "logs:CreateLogGroup",
                    "logs:CreateLogStream",
                  ],
                  Resource: "*",
                },
              ],
            },
          },
        ],
      },
    },
  
    KendraCrawlerPost: {
      Type: "AWS::ApiGateway::Method",
      Properties: {
        AuthorizationType: "AWS_IAM",
        HttpMethod: "POST",
        RequestParameters: {
          "method.request.querystring.message": false,
          "method.request.querystring.subject": false,
          "method.request.querystring.topic": false,
        },
        Integration: {
          Type: "AWS",
          Credentials: {
            "Fn::GetAtt": ["KendraTopicApiGateRole", "Arn"],
          },
          Uri: {
            "Fn::Join": [
              "",
              [
                "arn:aws:apigateway:",
                { Ref: "AWS::Region" },
                ":sns:action/Publish",
              ],
            ],
          },
          IntegrationHttpMethod: "POST",
          RequestParameters: {
            "integration.request.querystring.TopicArn":
              "method.request.querystring.topic",
            "integration.request.querystring.Subject":
              "method.request.querystring.subject",
            "integration.request.querystring.Message":
              "method.request.querystring.message",
          },
          IntegrationResponses: [
            {
              StatusCode: 200,
              ResponseTemplates: {
                "application/json": '{"status":"OK"}',
              },
            },
          ],
        },
        MethodResponses: [
          {
            StatusCode: 200,
          },
        ],
        RestApiId: { Ref: "Api" },
        ResourceId: { Ref: "KendraCrawlerApiResource" },
      },
    },
  
    InvokePermissionKendraCrawlerLambda: {
      Type: "AWS::Lambda::Permission",
      Properties: {
        Action: "lambda:InvokeFunction",
        FunctionName: { "Fn::GetAtt": ["KendraCrawlerLambda", "Arn"] },
        SourceArn: { Ref: "KendraCrawlerSnsTopic" },
        Principal: "sns.amazonaws.com",
      },
    },
    CloudWatchEventRule: {
      Type: "AWS::Events::Rule",
      Properties: {
        Description: "Parameter Setting Change",
        EventPattern: {
          source: ["aws.ssm"],
          "detail-type": ["Parameter Store Change"],
          detail: {
            name: [{ Ref: "CustomQnABotSettings" }],
            operation: ["Update"],
          },
        },
        State: "ENABLED",
        Targets: [
          //Add Lambda targets here as needed
          {
            Arn: {
              "Fn::GetAtt": ["KendraCrawlerLambda", "Arn"],
            },
            Id: "KendraCrawler",
          },
        ],
      },
    },
    ParameterChangeRuleKendraCrawlerPermission: {
      Type: "AWS::Lambda::Permission",
      Properties: {
        FunctionName: {
          "Fn::GetAtt": ["KendraCrawlerLambda", "Arn"],
        },
        Action: "lambda:InvokeFunction",
        Principal: "events.amazonaws.com",
        SourceArn: {
          "Fn::GetAtt": ["CloudWatchEventRule", "Arn"],
        },
      },
    },
    KendraCrawlerScheduleRule: {
      Type: "AWS::Events::Rule",
      DependsOn:"CloudWatchEventRule",
      Properties: {
        Description: "Run Kendra Web Crawler based on a schedule",
        ScheduleExpression: "rate(1 day)",
        Name: {
          // KendraCrawlerLambda needs the name of the Rule.  Can't Ref the resource as an environment variable.  Creates a circular dependency
          "Fn::Join": [
            "-",
            [
              "KendraCrawlerRule",
              {
                "Fn::Select": [
                  2,
                  { "Fn::Split": ["-", { Ref: "DefaultQnABotSettings" }] },
                ],
              },
            ],
          ],
        },
        State: "DISABLED",
        Targets: [
          {
            Arn: {
              "Fn::GetAtt": ["KendraCrawlerLambda", "Arn"],
            },
            Id: "KendraCrawler",
          },
        ],
      },
    },
    KendraCrawlerSchedulePermission: {
      Type: "AWS::Lambda::Permission",
      Properties: {
        FunctionName: {
          "Fn::GetAtt": ["KendraCrawlerLambda", "Arn"],
        },
        Action: "lambda:InvokeFunction",
        Principal: "events.amazonaws.com",
        SourceArn: {
          "Fn::GetAtt": ["KendraCrawlerScheduleRule", "Arn"],
        },
      },
    },
  
    KendraCrawlerStatusRootApiResource: {
      Type: "AWS::ApiGateway::Resource",
      Properties: {
        ParentId: { Ref: "KendraCrawlerApiRootResource" },
        PathPart: "{proxy+}",
        RestApiId: { Ref: "Api" },
      },
    },  
    KendraCrawlerLambda: {
      Type: "AWS::Lambda::Function",
      Properties: {
        Code: {
          S3Bucket: { Ref: "BootstrapBucket" },
          S3Key: { "Fn::Sub": "${BootstrapPrefix}/lambda/kendra-crawler.zip" },
          S3ObjectVersion: { Ref: "KendraCodeVersion" },
        },
        "VpcConfig": {
          "Fn::If": [
            "VPCEnabled",
            {
              "SubnetIds": {"Ref": "VPCSubnetIdList"},
              "SecurityGroupIds": {"Ref": "VPCSecurityGroupIdList"}
            },
            {"Ref": "AWS::NoValue"}
          ]
        },
        "TracingConfig": {
          "Fn::If": ["XRAYEnabled", {"Mode": "Active"}, {"Ref": "AWS::NoValue"}]
        },
        Environment: {
          Variables: {
            DEFAULT_SETTINGS_PARAM: { Ref: "DefaultQnABotSettings" },
            CUSTOM_SETTINGS_PARAM: { Ref: "CustomQnABotSettings" },
            CLOUDWATCH_RULENAME: {
              "Fn::Join": [
                //Can't Ref the CloudWatchRule - creates circular dependency
                "-",
                [
                  "KendraCrawlerRule",
                  {
                    "Fn::Select": [
                      2,
                      { "Fn::Split": ["-", { Ref: "DefaultQnABotSettings" }] },
                    ],
                  },
                ],
              ],
            },
            DATASOURCE_NAME: {
              "Fn::Join": [
                "-",
                [
                  "QNABotKendraCrawler",
                  {
                    "Fn::Select": [
                      2,
                      { "Fn::Split": ["-", { Ref: "DefaultQnABotSettings" }] },
                    ],
                  },
                ],
              ],
            },
          },
        },
        Handler: "index.handler",
        MemorySize: "2048",
        Role: { "Fn::GetAtt": ["KendraCrawlerRole", "Arn"] },
        Runtime: "nodejs12.x",
        Timeout: 900,
        Tags: [
          {
            Key: "Type",
            Value: "Export",
          },
        ],
      },
    },
    KendraCrawlerRole: {
      Type: "AWS::IAM::Role",
      Properties: {
        AssumeRolePolicyDocument: {
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Principal: {
                Service: "lambda.amazonaws.com",
              },
              Action: "sts:AssumeRole",
            },
          ],
        },
        Path: "/",
        ManagedPolicyArns: [
          "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
          { Ref: "KendraCrawlerPolicy" },
        ],
      },
    },
    KendraCrawlerPolicy: {
      Type: "AWS::IAM::ManagedPolicy",
      Properties: {
        PolicyDocument: {
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Action: [
                "kendra:ListDataSources",
                "kendra:ListDataSourceSyncJobs",
                "kendra:DescribeDataSource",
                "kendra:BatchPutDocument",
                "kendra:CreateDataSource",
                "kendra:StartDataSourceSyncJob",
                "kendra:StopDataSourceSyncJob",
                "kendra:UpdateDataSource",
              ],
              Resource: ["*"],
            },
            {
              Effect: "Allow",
              Action: [
                "ssm:GetParameter",
              ],
              Resource: [
                {"Fn::Join": ["",["arn:aws:ssm:",{"Ref":"AWS::Region"},":",{"Ref":"AWS::AccountId"},":parameter/",{"Ref":"CustomQnABotSettings"}]]},
                {"Fn::Join": ["",["arn:aws:ssm:",{"Ref":"AWS::Region"},":",{"Ref":"AWS::AccountId"},":parameter/",{"Ref":"DefaultQnABotSettings"}]]},
            ],
            },
  
            {
              Effect: "Allow",
              Action: ["events:DescribeRule", "events:PutRule"],
              Resource: {
                "Fn::Join": [
                  //Can't Ref the CloudWatchRule - creates circular dependency
                  "",
                  ["arn:aws:events:",{"Ref":"AWS::Region"},":",{"Ref":"AWS::AccountId"},":rule/",
                    "KendraCrawlerRule-",
                    {
                      "Fn::Select": [
                        2,
                        { "Fn::Split": ["-", { Ref: "DefaultQnABotSettings" }] },
                      ],
                    },
                  ],
                ],
              },
            },
          ],
        },
      },
    },
    "KendraS3Policy": {
      "Type": "AWS::IAM::ManagedPolicy",
      "Properties": {
        "PolicyDocument": {
        "Version": "2012-10-17",
        "Statement": [{
          "Effect": "Allow",
          "Action": [
              "s3:GetObject",
              "kendra:CreateFaq",
            ],
            "Resource": [
                {"Fn::Sub":"arn:aws:kendra:${AWS::Region}:${AWS::AccountId}:index/*"},
                {"Fn::Sub":"arn:aws:s3:::${ExportBucket}"},
                {"Fn::Sub":"arn:aws:s3:::${ExportBucket}/*"},
            ]
          }]
        }
      }
    }
  }
)


