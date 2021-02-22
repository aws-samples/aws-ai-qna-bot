var default_settings = {
    ENABLE_DEBUG_RESPONSES: "false",  // Determines whethere to log original English responses and translated responses for debugging
    ES_USE_KEYWORD_FILTERS: "true", // Determines whether to detect keywords from Comprehend when searching for answers
    ES_EXPAND_CONTRACTIONS: `{"you're":"you are","I'm":"I am","can't":"cannot"}`,
    ES_KEYWORD_SYNTAX_TYPES: "NOUN,PROPN,VERB,INTJ", //Comprehend will return these parts of speech found by Amazon Comprehend
    ES_SYNTAX_CONFIDENCE_LIMIT: ".20", //  Comprehend makes a best effort to determine the parts of speech  in a sentence. The keywords will only be used if the confidence limit is greater than this amount
    ES_MINIMUM_SHOULD_MATCH: "2<75%", // Refer to https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-minimum-should-match.html for more information
    ES_NO_HITS_QUESTION: "no_hits", // The QID of the question when no answers could be found for a user's question
    ES_USE_FUZZY_MATCH: "false", // Refer to https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-fuzzy-query.html
    ES_PHRASE_BOOST: "4", //TODO: Ask Bob
    ES_SCORE_ANSWER_FIELD: "false",//TODO: Ask Bob
    ENABLE_SENTIMENT_SUPPORT: "true", //Determines whether to use Comprehend for sentiment analysis.  Refer to https://docs.aws.amazon.com/comprehend/latest/dg/how-sentiment.html 
    ENABLE_MULTI_LANGUAGE_SUPPORT: "false", //User can override and set to true to Enable Multilanguage support
    ENABLE_CUSTOM_TERMINOLOGY: "false",
    CUSTOM_TERMINOLOGY_SOURCES: "pets", //A comma separated list of custom terminology dictionaries https://docs.aws.amazon.com/translate/latest/dg/how-custom-terminology.html 
    MINIMUM_CONFIDENCE_SCORE: 0.6, //User can override this value to set the minimum confidence they accept using CustomQnABotSettings
    ALT_SEARCH_KENDRA_INDEXES: [], // Add Kendra index to array to enable Amazon Kendra as a fallback source of answers
    ALT_SEARCH_KENDRA_S3_SIGNED_URLS: "false", // If S3 document URL is in the search result, convert to signed URL. Make sure IAM ExtensionLambdaRole has access to S3 objects in Kendra index.
    ALT_SEARCH_KENDRA_S3_SIGNED_URL_EXPIRE_SECS: 300, // Expiry time for signed URLs
    ALT_SEARCH_KENDRA_MAX_DOCUMENT_COUNT: 2, // limit number of document search results returned by Kendra fallback\
    ALT_SEARCH_KENDRA_TOP_ANSWER_MESSAGE: "Amazon Kendra suggested answer.",
    ALT_SEARCH_KENDRA_ANSWER_MESSAGE: "While I did not find an exact answer, these search results from Amazon Kendra might be helpful.", //Message displayed when a search comes from Kemdra
    KENDRA_FAQ_INDEX: "", // Kendra Index specific for FAQ for if Kendra FAQ sync is enabled
    KENDRA_FAQ_CONFIG_MAX_RETRIES: 8,    //User can override number of max retries in AWS SDK configurations
    KENDRA_FAQ_CONFIG_RETRY_DELAY: 600,  //User can override number of miliseconds delay between retries in AWS SDK configurations
    KENDRA_FAQ_ES_FALLBACK: "true", // Optional ElasticSearch Fallback engine for if KendraFAQ fails
    ENABLE_KENDRA_WEB_INDEXER:"true", //Enables web crawler -- indexes pages specified by KENDRA_INDEXER_URLS
    KENDRA_INDEXER_URLS: "",//comma separated list of urls for Kendra to crawler
    KENDRA_INDEXER_SCHEDULE: "rate(1 day)",//See https://docs.aws.amazon.com/AmazonCloudWatch/latest/events/ScheduledEvents.html for valid expressions
    KENDRA_WEB_PAGE_INDEX: "",//The index to use for the web crawler, a custom data source will automatically be added to the specified index.  The index will automatically be added to ALT_SEARCH_KENDRA_INDEXES
    ERRORMESSAGE: "Unfortunately I encountered an error when searching for your answer. Please ask me again later.",
    EMPTYMESSAGE: "You stumped me! Sadly I don't know how to answer your question.",
    DEFAULT_ALEXA_LAUNCH_MESSAGE: "Hello, Please ask a question",
    DEFAULT_ALEXA_REPROMPT: "Please either answer the question, ask another question or say Goodbye to end the conversation.",
    DEFAULT_ALEXA_STOP_MESSAGE: "Goodbye",
    SMS_HINT_REMINDER_ENABLE: "true",
    SMS_HINT_REMINDER: " (Feedback? Reply THUMBS UP or THUMBS DOWN. Ask HELP ME at any time)",
    SMS_HINT_REMINDER_INTERVAL_HRS: "24",
    IDENTITY_PROVIDER_JWKS_URLS: [],  // User can override this empty list to add trusted IdPs (eg from Lex-Web-UI)
    ENFORCE_VERIFIED_IDENTITY: "false", // set to true to make QnABot require verified identity from client
    NO_VERIFIED_IDENTITY_QUESTION: "no_verified_identity", // if user identity cannot be verified, replace question string with this. 
    ELICIT_RESPONSE_MAX_RETRIES: 3, // Number of times an elicitResponse LexBot can be called before giving up when the Bot returns Failed
    ELICIT_RESPONSE_RETRY_MESSAGE: "Please try again?", // Default retry message when working with LexBot
    ELICIT_RESPONSE_BOT_FAILURE_MESSAGE: "Your response was not understood. Please start again.", // Message used when maximum number of retries is exceeded
    ELICIT_RESPONSE_DEFAULT_MSG: "Ok. ", // Ok. with an intentional blank space after the period
    CONNECT_IGNORE_WORDS: "", // Throw error if connect client sends individual characters not processable by elastic search
    CONNECT_ENABLE_VOICE_RESPONSE_INTERRUPT: "false", // Return bot response in session attribute to enable contact flow to use response as an interruptible prompt.
    CONNECT_NEXT_PROMPT_VARNAME: "connect_nextPrompt", // Name of session var to use for next prompt
    ENABLE_REDACTING: "false", // Enable the system to redact log output
    REDACTING_REGEX: "\\b\\d{4}\\b(?![-])|\\b\\d{9}\\b|\\b\\d{3}-\\d{2}-\\d{4}\\b", // default regex to use for redacting - redacts 4 digit numbers not followed by a '-', 9 digit numbers (SSN with no '-'s), and Standard SSN format
    PII_REJECTION_ENABLED: false, // Enables PII Rejection
    PII_REJECTION_QUESTION: "pii_rejection_question", // If PII is found, the user's request (question) will change to this phrase
    PII_REJECTION_WITH_COMPREHEND: true, //When set to true, Comprehend will be used for PII detection in addition to matching  based on the PII_REJECTION_REGE
    PII_REJECTION_REGEX: "\\b\\d{4}\\b(?![-])|\\b\\d{9}\\b|\\b\\d{3}-\\d{2}-\\d{4}\\b", //Regex to use to find PII.,
    PII_REJECTION_IGNORE_TYPES: "Name,Address", //See https://aws.amazon.com/blogs/machine-learning/detecting-and-redacting-pii-using-amazon-comprehend/ for valid types
    DISABLE_CLOUDWATCH_LOGGING: "false", // disable all logging in fulfillment es query handler lambda. does not disable logging from Lambda Hooks or Conditional Chaining Lambda functions
    MINIMAL_ES_LOGGING: "false", // do not log utterances or session attributes to elasticsearch for kibana logging
    S3_PUT_REQUEST_ENCRYPTION: "", // enable header x-amz-server-side-encryption header and set with this value
    BOT_ROUTER_WELCOME_BACK_MSG: "Welcome back to QnABot.", // The text used by QnABot when ending communication from a specialty bot
    BOT_ROUTER_EXIT_MSGS: "exit,quit,goodbye,leave" // The exit phrases in comma separated list available for the a user to end communication with a specialty bot
}

module.exports = {
    "DefaultUserPoolJwksUrl": {
        "Type": "AWS::SSM::Parameter",
        "Properties": {
            "Description": "Default QnABot Setting - DO NOT MODIFY",
            "Type": "String",
            "Value": { "Fn::Join": ["", ["https://cognito-idp.", { "Ref": "AWS::Region" }, ".amazonaws.com/", { "Ref": "UserPool" }, "/.well-known/jwks.json"]] }
        }
    },
    "DefaultQnABotSettings": {
        "Type": "AWS::SSM::Parameter",
        "Properties": {
            "Description": "Default QnABot Settings - DO NOT MODIFY",
            "Type": "String",
            "Value": JSON.stringify(default_settings)
        }
    },
    "CustomQnABotSettings": {
        "Type": "AWS::SSM::Parameter",
        "Properties": {
            "Description": "Custom QnABot Settings - Modify to override defaults, or to add new settings",
            "Type": "String",
            "Value": "{}"
        }
    }
}
