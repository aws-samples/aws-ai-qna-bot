#! /usr/bin/env node



(async () => {
    process.env.AWS_SDK_LOAD_CONFIG = true;

    var AWS = require("aws-sdk");
    var sts = new AWS.STS();
    var region = AWS.config.region;

 


    var account = (await sts.getCallerIdentity({}).promise()).Account;
    var policy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Action": [
                    "cloudwatch:PutMetricData"
                ],
                "Resource": "*",
                "Condition": {
                    "StringEquals": {
                        "cloudwatch:namespace": "AWS/Kendra"
                    }
                }
            },
            {
                "Effect": "Allow",
                "Action": [
                    "logs:DescribeLogGroups"
                ],
                "Resource": "*"
            },
            {
                "Effect": "Allow",
                "Action": [
                    "logs:CreateLogGroup"
                ],
                "Resource": [
                    `arn:aws:${region}:${account}:log-group:/aws/kendra/*`
                ]
            },
            {
                "Effect": "Allow",
                "Action": [
                    "logs:DescribeLogStreams",
                    "logs:CreateLogStream",
                    "logs:PutLogEvents"
                ],
                "Resource": [
                    `arn:aws:logs:${region}:${account}:log-group:/aws/kendra/*:log-stream:*`
                ]
            }
        ]
    }
    
    
    var getPolicyParams = {
        PolicyArn: `arn:aws:iam::${account}:policy/AmazonKendra-${region}-QnABot`
      };
    
    var iam = new AWS.IAM();
    var doesPolicyExist = false;
    try
    {
      var policy = await iam.getPolicy(getPolicyParams).promise();
      doesPolicyExist = true;
    }
    catch {};
      
    if(!doesPolicyExist)
    {
        await iam.createPolicy({
            PolicyDocument: JSON.stringify(policy),
            PolicyName: `AmazonKendra-${region}-QnABot`,
            Description: 'Policy for Kendra - Created by QnABot',
          }).promise();
    }

    var doesRoleExist = false;

    try{
        await iam.getRole({RoleName:`AmazonKendra-${region}-QnaBot`}).promise();
        doesRoleExist = true;
    }catch{}

    if(!doesRoleExist)
    {
        var policyDocument = {
            "Version": "2012-10-17",
            "Statement": [
              {
                "Effect": "Allow",
                "Principal": {
                  "Service": "kendra.amazonaws.com"
                },
                "Action": "sts:AssumeRole"
              }
            ]
          }

        var params = {
            AssumeRolePolicyDocument: JSON.stringify(policyDocument), 
            Path: "/", 
            RoleName: `AmazonKendra-${region}-QnaBot`
           };
        await iam.createRole(params).promise();

    }

var params = {
  PolicyArn: `arn:aws:iam::${account}:policy/AmazonKendra-${region}-QnABot`, 
  RoleName: `AmazonKendra-${region}-QnaBot`
 };
 await iam.attachRolePolicy(params).promise();

 var kendra = new AWS.Kendra();

 var indexResult = await kendra.listIndices().promise();
 var indexCount = indexResult.IndexConfigurationSummaryItems.length;
 var createdIndex =  null;
 if(indexCount == 0)
 {
    var kendraCreateIndexParams = {
        Name: 'QnABot', /* required */
        RoleArn: `arn:aws:iam::${account}:role/AmazonKendra-${region}-QnaBot`, /* required */
        Description: 'Created by QnABot',
        Edition: "ENTERPRISE_EDITION",
    }
    createdIndex = await kendra.createIndex(kendraCreateIndexParams).promise().Id
 }
 else
 {
     console.log("WARNING:Existing Kendra indexes found.  Did not create a new index")
 }
 if(createdIndex){
    console.log(`Add ${createdIndex} to the  KENDRA_FAQ_INDEX setting in the Content Designer`)

 } else {

    console.log("Add one of the following indexes to the  KENDRA_FAQ_INDEX setting in the Content Designer")
    for(index of indexResult.IndexConfigurationSummaryItems)
    {
        console.log(`${index.Id}    ${index.Status}`)
    }
   
 }

  })();
