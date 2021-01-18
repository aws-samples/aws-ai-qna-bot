var config = require('./config')
var _ = require('lodash')

var examples = _.fromPairs(require('../../examples/outputs')
  .names
  .map(x => {
    return [x, { "Fn::GetAtt": ["ExamplesStack", `Outputs.${x}`] }]
  }))
var responsebots = _.fromPairs(require('../../examples/examples/responsebots')
  .names
  .map(x => {
    return [x, { "Fn::GetAtt": ["ExamplesStack", `Outputs.${x}`] }]
  }))

module.exports = {
  "Alexa": {
    "Type": "AWS::Lambda::Permission",
    "Properties": {
      "Action": "lambda:InvokeFunction",
      "FunctionName": { "Fn::GetAtt": ["FulfillmentLambda", "Arn"] },
      "Principal": "alexa-appkit.amazon.com"
    }
  },
  "FulfillmentCodeVersion": {
    "Type": "Custom::S3Version",
    "Properties": {
      "ServiceToken": { "Fn::GetAtt": ["CFNLambda", "Arn"] },
      "Bucket": { "Ref": "BootstrapBucket" },
      "Key": { "Fn::Sub": "${BootstrapPrefix}/lambda/fulfillment.zip" },
      "BuildDate": (new Date()).toISOString()
    }
  },
  "FulfillmentLambda": {
    "Type": "AWS::Lambda::Function",
    "Properties": {
      "Code": {
        "S3Bucket": { "Ref": "BootstrapBucket" },
        "S3Key": { "Fn::Sub": "${BootstrapPrefix}/lambda/fulfillment.zip" },
        "S3ObjectVersion": { "Ref": "FulfillmentCodeVersion" }
      },
      "Environment": {
        "Variables": Object.assign({
          ES_TYPE: { "Fn::GetAtt": ["Var", "QnAType"] },
          ES_INDEX: { "Fn::GetAtt": ["Var","QnaIndex"] },
          ES_ADDRESS: { "Fn::GetAtt": ["ESVar", "ESAddress"] },
          LAMBDA_DEFAULT_QUERY: { "Ref": "ESQueryLambda" },
          LAMBDA_LOG: { "Ref": "ESLoggingLambda" },
          ES_SERVICE_QID: { "Ref": "ESQidLambda" },
          ES_SERVICE_PROXY: { "Ref": "ESProxyLambda" },
          DYNAMODB_USERSTABLE: { "Ref": "UsersTable" },
          DEFAULT_USER_POOL_JWKS_PARAM: { "Ref": "DefaultUserPoolJwksUrl" },
          DEFAULT_SETTINGS_PARAM: { "Ref": "DefaultQnABotSettings" },
          CUSTOM_SETTINGS_PARAM: { "Ref": "CustomQnABotSettings" },
        }, examples, responsebots)
      },
      "Handler": "index.handler",
      "MemorySize": "1408",
      "Role": { "Fn::GetAtt": ["FulfillmentLambdaRole", "Arn"] },
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
      "Tags": [{
        Key: "Type",
        Value: "Fulfillment"
      }]
    }
  },
  "InvokePolicy": {
    "Type": "AWS::IAM::ManagedPolicy",
    "Properties": {
      "PolicyDocument": {
        "Version": "2012-10-17",
        "Statement": [{
          "Effect": "Allow",
          "Action": [
            "lambda:InvokeFunction"
          ],
          "Resource": [
            "arn:aws:lambda:*:*:function:qna-*",
            "arn:aws:lambda:*:*:function:QNA-*",
            { "Fn::GetAtt": ["ESQueryLambda", "Arn"] },
            { "Fn::GetAtt": ["ESProxyLambda", "Arn"] },
            { "Fn::GetAtt": ["ESLoggingLambda", "Arn"] },
            { "Fn::GetAtt": ["ESQidLambda", "Arn"] },
          ].concat(require('../../examples/outputs').names
            .map(x => {
              return { "Fn::GetAtt": ["ExamplesStack", `Outputs.${x}`] }
            }))
        }]
      },
      "Roles": [{ "Ref": "FulfillmentLambdaRole" }]
    }
  },
  "LexBotPolicy": {
    "Type": "AWS::IAM::ManagedPolicy",
    "Properties": {
      "PolicyDocument": {
        "Version": "2012-10-17",
        "Statement": [{
          "Effect": "Allow",
          "Action": [
            "lex:PostText"
          ],
          "Resource": [
            "arn:aws:lex:*:*:bot:QNA*",
            "arn:aws:lex:*:*:bot:QnA*",
          ]
        }]
      },
      "Roles": [{ "Ref": "FulfillmentLambdaRole" }]
    }
  },
  "FulfillmentLambdaRole": {
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
        "arn:aws:iam::aws:policy/ComprehendReadOnly",
        { "Ref": "QueryPolicy" }
      ],
      "Policies": [
        {
          "PolicyName": "ParamStorePolicy",
          "PolicyDocument": {
            "Version": "2012-10-17",
            "Statement": [{
              "Effect": "Allow",
              "Action": [
                "ssm:GetParameter",
                "ssm:GetParameters"
              ],
              "Resource": [
                {
                  "Fn::Join": [
                    "", [
                      "arn:aws:ssm:",
                      { "Fn::Sub": "${AWS::Region}:" },
                      { "Fn::Sub": "${AWS::AccountId}:" },
                      "parameter/",
                      { "Ref": "DefaultQnABotSettings" }
                    ]
                  ]
                },
                {
                  "Fn::Join": [
                    "", [
                      "arn:aws:ssm:",
                      { "Fn::Sub": "${AWS::Region}:" },
                      { "Fn::Sub": "${AWS::AccountId}:" },
                      "parameter/",
                      { "Ref": "CustomQnABotSettings" }
                    ]
                  ]
                },
                {
                  "Fn::Join": [
                    "", [
                      "arn:aws:ssm:",
                      { "Fn::Sub": "${AWS::Region}:" },
                      { "Fn::Sub": "${AWS::AccountId}:" },
                      "parameter/",
                      { "Ref": "DefaultUserPoolJwksUrl" }
                    ]
                  ]
                }
              ]
            }]
          }
        },
        {
          "PolicyName": "DynamoDBPolicy",
          "PolicyDocument": {
            "Version": "2012-10-17",
            "Statement": [{
              "Effect": "Allow",
              "Action": [
                "dynamodb:GetItem",
                "dynamodb:PutItem",
              ],
              "Resource": [
                { "Fn::GetAtt": ["UsersTable", "Arn"] }
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
  }
}

