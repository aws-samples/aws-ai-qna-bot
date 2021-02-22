const path = require('path');
const fs = require("fs");
const AWS=require('aws-sdk')

const { Readable } = require("stream");



exports.handler =  async function(event, context) {
    try {
            var result = await createCallFlow();
            return result;
    } catch (e) {
        console.log(e)
        return{
            statusCode: 500,
            message: e
        }
    }


    
  }
  
 
  

  function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  async function createCallFlow() {
    console.log(process.cwd())
    let flows = fs.readdirSync(`${__dirname}/flows`);
    if(flows.length != 1)
    {
        throw {
            message: "Exactly one contact flow is currently supported"
        }
    }
    let flowfile = path.join(`${__dirname}/flows`,flows[0])
    let rawdata = fs.readFileSync(flowfile);
    let flow = JSON.parse(rawdata);
    let userInputModules = flow["modules"]
        .filter(module => module.type == "GetUserInput")
        .filter(module => module.parameters.filter(parameter => parameter.name == "BotName" || parameter.name == "BotRegion").length > 0)
        .filter(module => module.branches.filter(branch => branch.condition == "Evaluate" 
                                                        && branch.conditionValue 
                                                        && branch.conditionValue.includes("fulfilment_Intent")).length > 0)
    for(element of userInputModules)
    {

            botParm = element.parameters.find(parm => parm.name == "BotName" )
            botParm.value = process.env.lexBot;
            region = element.parameters.find(parm => parm.name == "BotRegion")
            region.value = process.env.AWS_REGION;
            botBranchesIntent = element.branches.find(parm => parm.conditionValue && parm.conditionValue.startsWith("fulfilment_Intent"));
            botBranchesIntent.conditionValue = process.env.intent;
            botBranchesFallbackIntent = element.branches.find(parm => parm.conditionValue && parm.conditionValue.includes("fallbackfulfilment_Intent"));
            botBranchesFallbackIntent.conditionValue = process.env.fallBackIntent;

            metadata = element.metadata.conditionMetadata;
            botMetaDataIntent = metadata.find(data => data.value.startsWith("fulfilment_Intent"));
            botMetaDataIntent.value = process.env.intent;
            botMetaDataFallbackIntent = metadata.find(data => data.value.includes("fallbackfulfilment_Intent"));
            botMetaDataFallbackIntent.value = process.env.fallBackIntent;
        
    };
    
    let configFile = path.join(`${__dirname}`,"questions.json")
    let config = fs.readFileSync(configFile);
    config = JSON.parse(config);



    return {
      CallFlow: flow,
      FileName: flows[0],
      QnaFile: config.FlowInfos.filter(c => c.ContactFlow == flows[0])[0].QnAExample

    };
  }


 
// (async () => {
//   process.env.AWS_REGION = "us-west-2"
//   var result = await createCallFlow()
// })()