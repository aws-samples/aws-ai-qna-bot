
- [Resources](#resources)
  - [Cognito](#cognito)
  - [S3](#s3)
  - [Firehose](#firehose)
  - [APIGateway](#apigateway)
  - [DynamoDB](#dynamodb)
  - [ElasticSearch](#elasticsearch)
  - [Lambda (42 functions)](#lambda-42-functions)
  - [Lex](#lex)
  - [SNS](#sns)
  - [KMS](#kms)
  - [CloudWatch Events](#cloudwatch-events)
  - [CloudWatch Logs](#cloudwatch-logs)
  - [Comprehend](#comprehend)
  - [Kendra](#kendra)
  - [Parameter Store](#parameter-store)
  - [S3](#s3-1)
  - [Translate](#translate)
  - [Polly](#polly)
  - [Kinesis Firehose](#kinesis-firehose)
- [Roles](#roles-1)
  - [CFNLambdaRole (Bootstrap Stack)](#cfnlambdarole-bootstrap-stack)
  - [CFNLambdaRole (QnABot Stack)](#cfnlambdarole-qnabot-stack)
    - [CFNLambda](#cfnlambda)
    - [ExampleWriteLambda](#examplewritelambda)
    - [EXTUiImportLambda](#extuiimportlambda)
    - [VersionLambda](#versionlambda)
  - [ESProxyLambdaRole](#esproxylambdarole)
    - [ESProxyLambda](#esproxylambda)
    - [ESCleaningLambda](#escleaninglambda)
    - [ESCFNProxyLambda](#escfnproxylambda)
    - [ESQidLambda](#esqidlambda)
    - [ESQueryLambda](#esquerylambda)
    - [UtteranceLambda](#utterancelambda)
  - [ESLoginLambdaRole](#esloginlambdarole)
    - [ESLoggingLambda](#eslogginglambda)
  - [ExampleLambdaRole](#examplelambdarole)
    - [ExampleJSLambdaQuiz](#examplejslambdaquiz)
    - [ExamplePythonLambda](#examplepythonlambda)
    - [ExamplePythonLambdaConnect](#examplepythonlambdaconnect)
    - [ExamplePythonLambdaFeedback](#examplepythonlambdafeedback)
    - [ExamplePythonLambdaNext](#examplepythonlambdanext)
    - [ExamplePythonLambdaPrevious](#examplepythonlambdaprevious)
    - [ExamplePythonLambdahello](#examplepythonlambdahello)
    - [ExampleS3ListPhotoLambda](#examples3listphotolambda)
    - [ExampleLambdaRole](#examplelambdarole-1)
    - [ExampleJSLambdaHook](#examplejslambdahook)
  - [KendraCrawlerRole](#kendracrawlerrole)
    - [KendraCrawlerLambda](#kendracrawlerlambda)
  - [ExtensionLambdaRole](#extensionlambdarole)
    - [KendraFallback](#kendrafallback)
    - [EXTCustomPyHook](#extcustompyhook)
  - [S3ListLambdaRole](#s3listlambdarole)
    - [ExampleS3ListLambda](#examples3listlambda)
    - [S3ListLambda](#s3listlambda)
  - [ExportRole](#exportrole)
    - [ExportStepLambda](#exportsteplambda)
  - [KendraSyncRole](#kendrasyncrole)
    - [KendraSyncLambda](#kendrasynclambda)
  - [TranslateRole](#translaterole)
    - [TranslateLambda](#translatelambda)
  - [ConnectRole](#connectrole)
    - [ConnectLambda](#connectlambda)
  - [FullfillmentLambdaRole](#fullfillmentlambdarole)
    - [FullfillmentLambda](#fullfillmentlambda)
  - [ImportRole](#importrole)
    - [ImportStartLambda](#importstartlambda)
    - [ImportStepLambda](#importsteplambda)
  - [LexBuildLambdaRole](#lexbuildlambdarole)
    - [LexBuildLambda](#lexbuildlambda)
    - [LexBuildLambdaPoll](#lexbuildlambdapoll)
    - [LexBuildLambdaStart](#lexbuildlambdastart)
  - [LexProxyLambdaRole](#lexproxylambdarole)
    - [LexProxyLambda](#lexproxylambda)
    - [LexStatusLambda](#lexstatuslambda)
  - [SignupLambdaRole – not used (deprecated)](#signuplambdarole-not-used-deprecated)
    - [MessageLambda](#messagelambda)
  - [SignupLambda](#signuplambda)
    - [SchemaLambdaRole](#schemalambdarole)
  - [SchemaLambda](#schemalambda)
  - [TestAllRole](#testallrole)
    - [TestAllStepLambda](#testallsteplambda)

<!-- /code_chunk_output -->

# Roles
- Master Stack - 20
- Example Stack - 2
- Export - 6
- Import - 1
- TestAll - 1
- Bootstrap  (separate stack used for deployments) - 1

*Total - 30*
# Resources
## Cognito 
- User Pool - authenticated login to Content Designer
- Identity Pool - supports API Gateway IAM authentication when calling supported Lambdas
## S3
- AssetBucket - additional components used to extend QnABot
- BuildStatusBucket - used for staging various assets during deployment
- ExportBucket - Used for staging files exported from QnABot.  API Gateway is used a proxy for the bucket
- ImportBucket - Used for staging files imported into QnABot
- MetricsBucket - All captured usage data is sent to both Elastic Search and this bucket via Kinesis 

## Firehose
- TestAllBucket - Results from “Test all” functionality
- Bucket - HTML/CSS/Javascript used by the Content Designer

## APIGateway
- Lambda 
- S3
- SNS - APIGW has a 30 second timeout. The Kendra web crawler takes longer than 30 seconds.  The Content Designer calls the Crawler API to trigger an SNS message that starts the crawler Lambda
## DynamoDB
- Stores user session information.
## ElasticSearch
- Stores curated questions and answers
- Stores usage metrics

## Lambda (42 functions)
- Master 21
- Example  13
- Export 6
- Import 2
## Lex
- The chatbot engine

## SNS
- APIGW has a 30 second timeout. The Kendra web crawler takes longer than 30 seconds.  The Content Designer calls the Crawler API to trigger an SNS message that starts the crawler Lambda

## KMS
- There is an optional utility script which adds KMS/CMK encryption to many resources.  The list below is for the default use cases
- The quiz workflow - not used by RhodeIsland

## CloudWatch Events
- KendraCrawlerRule - Schedules the Kendra Crawler based on setting
- CloudWatchEventRule - triggered when the Parameter Store custom setting is changed. It in turns triggers the KendraCrawler Lambda that configures the KendraCrawlerRule to schedule the crawler to run

## CloudWatch Logs
- Lambda 
- Kendra

## Comprehend
- Sentiment Analysis - detects whether a question was positive, negative, neutral or mixed
- Language Detection - detects the user’s language, translates the text to English and translates the response from English to the user’s language
- Analyze Syntax - detects parts of speech in a sentence and searches for questions in ElasticSearch based on words that match specified parts of speech – i.e, Nouns, Adjectives, Verbs, etc
- PII Detection - detects whether a question contains Personally Identifiable Information and allows an administrator  to instruct QnABot to reject a question that contains certain types of PII.
## Kendra
- Kendra FAQ - Questions entered into QnABot are synchronized with Kendra FAQ for better matching
- Kendra Documents - QnABot has an integrated web crawler, web page contents are indexed with Kendra

## Parameter Store
- DefaultQnABotSettings - default settings for QnABot
- CustomQnABotSettings - any settings that are changed from th
e default by the user.  QnABot merges DefaultQnABotSettings and CustomQnABotSettings at runtime

## S3
- Static assets (HTML, CSS, JavaScript)  related to the Content Designer
- Holding area for data transfers between different processes
## Translate

- Translates user’s questions to and from English as necessary
- Custom Terminology - An administrator can import a CSV file with language pairs to override default translations

## Polly

- Convert voice to text
- Convert text to voice
## Kinesis Firehose
- Transfers messages from fulfillment lambda to Kinesis Firehose to the ElasticSearch index for Kibana and S3.
- Used to store feedback from the client to Kibana

# Roles
## CFNLambdaRole (Bootstrap Stack)

*Deletes the objects from S3 to allow the bucket to be deleted when the stack is deleted*

## CFNLambdaRole (QnABot Stack)

### CFNLambda

*A custom CloudFormation resource*

- Deploys APIGateway resources
- Creates and manages Cognito Identity Pools
- Updates ElasticSearch resources 
- Creates LexBot

S3 –  Unzips assets stored in S3

*CloudFormation will not recognize that a referenced zip file for a Lambda has changed using our deployment process.  This creates a new S3 version of the object.*

- Deletes contents of the bucket when QnABot is uninstalled so the bucket can be deleted

### ExampleWriteLambda 

*This lambda contains a collection of lambda hooks for QnABot and a custom resource to create the example documents.*

### EXTUiImportLambda 

*Custom CF resource that expands resources for custom extensions packages - in the Imports section of Tools*

### VersionLambda

*Reads versions of file based on CF parameter.  It forces CF to recognize a new version of the Lambda code so it will update the resource*

## ESProxyLambdaRole

### ESProxyLambda

*Processes user’s questions through a pipeline – used mostly in Content Designer*

- Reads settings from SSM Parameter Store
- Processes question with Comprehend (see above)
- Translates questions and answer if necessary (see above)
- Uses Kendra FAQ feature (see above)
- Supports “Rebuild Lex” functionality
- Uses KMS  to decrypt sessions encrypted by the quiz functionality 

### ESCleaningLambda 
*Scheduled job to expire metrics data from ElasticSearch*

### ESCFNProxyLambda 

*Proxies requests from API Gateway to ElasticSearch*

### ESQidLambda 
*Designed to just return a question ID – may be used by guided navigation package – research whether it is deprecated*

### ESQueryLambda 
*Same functionality as ESProxyLambda used mostly at runtime*

### UtteranceLambda 
*Returns slot types from the LexBot*

## ESLoginLambdaRole

### ESLoggingLambda
*Sends events to ElasticSearch using Firehose*

## ExampleLambdaRole

### ExampleJSLambdaQuiz 
*Showcases using QnABot for quizzes*
- KMS for encrypting questions - The quiz lambda sends the answer in a session attribute, and we didn't want people cheating by looking inside the session attribute.. we use KMS to encrypt it.
- Example of creating custom functionality using JavaScript.  It is not used by QnABot

### ExamplePythonLambda 
### ExamplePythonLambdaConnect
*demonstrates how QnABot can be asked by a user for a live agent based phone callback*

### ExamplePythonLambdaFeedback 
*Thumbs Up/Thumbs Down support*
- Uses a KMS/CMK to encrypt messages before sending them to Firehose

### ExamplePythonLambdaNext 
*Demonstrates branching questions – going to the next step in a branched workflow*

### ExamplePythonLambdaPrevious 
*Demonstrates branching questions – going to the next step in a branched workflow*

### ExamplePythonLambdahello
*This lambda contains a collection of lambda hooks for QnABot and a custom resource to create the example documents.*

### ExampleS3ListPhotoLambda 

### ExampleLambdaRole

### ExampleJSLambdaHook 
*This lambda contains a collection of lambda hooks for QnABot and a custom resource to create the example documents.*

## KendraCrawlerRole

### KendraCrawlerLambda 
*Supports indexing web pages*
- Reads settings from ParameterStore
- Dynamically changes the EventBridge KendraCrawlerRule based on a setting
- Creates custom Kendra Data Source and indexes web pages

## ExtensionLambdaRole

*This role will be used for all “extensions” to the question processing pipeline. Currently we have the Lambda(s) below configured*

### KendraFallback
*When enabled, if a question cannot be answered via the ElasticSearch query, QnABot searches the configured Kendra index(es)*

- Uses XRay for request tracing
- When configured via the PublicOrPrivate CF parameter, it is attached to a VPC
- Translates questions and answers between English and the users’s native language

### EXTCustomPyHook 
*Sample custom python Lambda hook*

## S3ListLambdaRole

### ExampleS3ListLambda

*Some of our samples embed images.  ExampleS3ListLambda provides endpoints to the images in S3 via APIGW*

### S3ListLambda 

*Users can import example files in the Content Designer stored on S3. This Lambda returns the URL of the API Gateway S3 proxy request to retrieve the file.*

## ExportRole

### ExportStepLambda

*Used as part of the export questions functionality.*

## KendraSyncRole

### KendraSyncLambda

*Syncs curated questions stored in ElasticSearch to Kendra FAQ*

- Reads settings from ParameterStore
- Reads JSON FAQ file from S3
- Syncs JSON FAQ file to Kendra FAQ
- When calling Kendra to sync FAQs, a role needs to be passed to the command to allow access to S3. This role needs “iam:passRole” permission

## TranslateRole
### TranslateLambda

- Used to managed importing Translate Custom Terminologies
## ConnectRole
### ConnectLambda

- Supports the Connect wizard. 
- processes and writes locally stored Connect Call Flows to S3
- Lambda Write permission (Not needed – SIM created in open source backlog)

## FullfillmentLambdaRole

### FullfillmentLambda
*Orchestrates processing pipeline for questions and answers*
- Lex (See services section)
- Lambda Write – calls other Lambdas
- Comprehend (see Services section)
- Kendra (see Service section)
- S3
- DynamoDB (see Services section)
- Parameter Store (see Services section)

## ImportRole

### ImportStartLambda
*Starts the import question and answer process*

### ImportStepLambda
*Supports the import question process in the Co*tent Designer*
- Reads the question file from S3
- Writes a status file that is retrieve via an API GW S3  Proxy

## LexBuildLambdaRole

### LexBuildLambda 
*Generates additional NLP training data for Lex using questions from questions added via the content designer*
- Reads questions from ElasticSearch to rebuild Lex model

### LexBuildLambdaPoll 
*Polls Lex service to determine build completion status*

- Stores status file in S3 read by API GW S3 proxy endpoint.

### LexBuildLambdaStart 
*Starts Lex Rebuild process*
- Stores status file in S3 read by API GW S3 proxy endpoint
## LexProxyLambdaRole

### LexProxyLambda

- Proxies Lex requests from API Gateway to Lex

### LexStatusLambda 

Reads status of the Lex Build process from status file S3 object and returns the status

## SignupLambdaRole – not used (deprecated)

### MessageLambda 

## SignupLambda 

### SchemaLambdaRole

## SchemaLambda 
*Supports the quiz functionality*
- ElasticSearchService

## TestAllRole

### TestAllStepLambda 
*Supports “Test All Questions” step in the Content Designer*
- Calls other Lambdas as needed to test questions and answers

