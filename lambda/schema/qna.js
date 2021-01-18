module.exports={
    type:"object",
    description:"Question and Answer document",
    properties:{
        qid:{
            type:"string",
            title:"Item ID",
            description:"Assign a unique identifier for this item.",
            maxLength:100,
            propertyOrder: 0
        },
        q:{
            title:"Questions",
            description:"Enter one or more questions that a user might ask.",
            type:"array",
            items:{
                title:"Question",
                type:"string",
                maxLength:140
            },
            propertyOrder: 1
        },
        a:{
            type:"string",
            title:"Answer",
            description:"Enter the answer you want to be returned when the user asks one of the above questions.",
            maxLength:8000,
            propertyOrder: 2
        },
        alt:{
            type:"object",
            description:"Alternate Answers",
            properties:{
                ssml:{
                    type:"string",
                    title:"SSML Answer",
                    description:"Alternate SSML answer",
                    maxLength:8000,
                    propertyOrder: 1
                },
                markdown:{
                    type:"string",
                    title:"Markdown Answer",
                    description:"Alternate Markdown answer",
                    maxLength:8000,
                    propertyOrder: 0
                },
            },
            propertyOrder: 3
        },
        rp:{
            type:"string",
            title:"Alexa Reprompt",
            description:"Enter the Alexa reprompt to returned if the user does not respond. (SSML autodetection with &lt;speak&gt;&lt;/speak&gt;)",
            maxLength:8000,
            propertyOrder: 4
        },
        t:{
            type:"string",
            description:"Assign a topic to this item, to support follow up questions on the same topic. (Sets session attribute 'topic' in response)",
            title:"Topic",
            propertyOrder: 5
        },
        r:{
            title:"Response card",
            description:"Attach images and/or buttons to your answer. A reponse card must have an imageUrl or at least one button.",
            type:"object",
            properties:{
                title:{
                    type:"string",
                    title:"Card Title",
                    description:"Required - max length of 80 after handlebars processing",
                    propertyOrder: 0
                },
                subTitle:{
                    type:"string",
                    title:"Card Subtitle",
                    description:"Optional - max length of 80 after handlebars processing",
                    propertyOrder: 1
                },
                imageUrl:{
                    type:"string",
                    description:"Optional",
                    title:"Card Image Url",
                    maxLength:2000,
                    propertyOrder: 2
                },
                buttons:{
                    title:"Lex Buttons",
                    description:"Add buttons for Amazon Lex client users. NOTE: Standard Amazon Lex clients will display up to 5 buttons only (Lex limit) - this limit does not apply to Lex-Web-UI version 0.16 or later.",
                    type:"array",
                    items:{
                        title:"Button",
                        type:"object",
                        properties:{
                            text: {
                                title: "Display Text",
                                type : "string",
                                propertyOrder: 0
                            },
                            value: {
                                title: "Button Value",
                                type : "string",
                                propertyOrder: 1
                            }
                        },
                        required:["text","value"]
                    },   
                    propertyOrder: 3
                }
            },
            propertyOrder:6,
            required:["title"]
        },
        l:{
            type:"string",
            description:"Enter your lambda function name/ARN to dynamically create or modify answers, or to redirect to a different question.",
            title:"Lambda Hook",
            propertyOrder:7
        },
        args:{
            title:"Lambda Hook Arguments",
            description:"If you named a lambda hook above and it requires additional information beyond what you've entered for this document, enter that information here.  You should not add anything here unless the lambda hook you named has been specifically coded to handle it.",
            type:"array",
            items:{
                title:"Argument",
                type:"string",
                maxLength:2000
            },
            propertyOrder:8
        },
        elicitResponse:{
            title:"Elicit Response",
            description:"If your answer includes a question to the user, configure QnABot to process and capture the user's response as session attributes.",
            type:"object",
            propertyOrder:9,
            properties:{
                responsebot_hook:{
                    title:"Elicit Response: ResponseBot Hook",
                    description:"To capture the next utterance as a response, provide the name of a Lex bot to parse the response and return at least one slot value, e.g. (QNAYesNo, QNADate, etc.). ResponseBot name must start with \"QNA\".",
                    type:"string",
                    maxLength:100,
                    propertyOrder:0
                },
                response_sessionattr_namespace:{
                    title:"Elicit Response: Response Session Attribute Namespace",
                    description:"Enter a string used as a name space for session attributes that will store returned slot values from the Response Bot.",
                    type:"string",
                    maxLength:100,
                    propertyOrder:1
                }
            }
        },
        conditionalChaining:{
            title:"Document Chaining: Chaining Rule",
            description:"Automatically move on to another item based on the question string returned by this rule. Rule can be a single-quoted string, e.g. 'next question', or a JavaScript conditional expression that evaluates to a string, e.g. (SessionAttributes.namespace.Yes_No == \"Yes\" ) ? \"Yes question\" : \"No Question\", or a Lambda Function Name or ARN that returns a string specified as \"Lambda::FunctionName\". Function name must start with \"QNA\".",
            type:"string",
            maxLength:4000,
            propertyOrder:10
        },
        next:{
            title:"Guided Navigation: Next QID",
            description:"If applicable, enter the QID of the document(s) that is/are next in the sequence, otherwise leave blank. Be careful; if you set this field to an earlier document in the sequence, you might make your sequence loop forever, which would not be fun!  You can add more QIDs after the first, but they won't do anything at the moment.",
            type:"string",
            maxLength:100,
            propertyOrder:11
        },
        botRouting:{
            title:"Bot Routing",
            description:"Use QnABot as a supervisory Bot and route to other Bots to handle the conversation. This parameter identifies a target Bot or Lambda with which to route communication.",
            type:"object",
            propertyOrder:12,
            properties:{
                specialty_bot:{
                    title:"Bot Routing: Bot Name or Lambda",
                    description:"The name of a Lex Bot (Specialty Bot) or Lambda Function to route requests to. Specialty Bot names must start with \"QNA\". Lambda functions can be specified as \"Lambda::FunctionName\" or \"Lambda::FunctionARN\" - Lambda function names must start with \"QNA\".",
                    type:"string",
                    maxLength:100,
                    propertyOrder:0
                },
                specialty_bot_name:{
                    title:"A simple name for the Specialty Bot that can optionally be presented in a user interface such as a bread crumb. (Required)",
                    description:"Enter a string used as the Specialty Bot's simple name.",
                    type:"string",
                    maxLength:100,
                    propertyOrder:1
                },
                specialty_bot_alias:{
                    title:"The Bot alias to use for the Specialty Bot. (Required for other Lex/QnA Bot targets - Not utilized when Lambda Function is used.)",
                    description:"Enter a string for the Specialty Bot's Lex alias.",
                    type:"string",
                    maxLength:100,
                    propertyOrder:2
                }
            }
        },
    },
    required:["qid","q","a"]

}