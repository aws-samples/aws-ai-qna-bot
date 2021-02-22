const _ = require('lodash');
const AWS = require('aws-sdk');


async function get_terminologies(sourceLang,allowedList =[]){
    const translate = new AWS.Translate();
        allowedList = allowedList.filter(a => a.length > 0)
        console.log("Getting registered custom terminologies")

        var configuredTerminologies = await  translate.listTerminologies({}).promise()



        console.log("terminology response " + JSON.stringify(configuredTerminologies))
        var sources = configuredTerminologies["TerminologyPropertiesList"].filter(t => t["SourceLanguageCode"] == sourceLang).map(s => s.Name);
        console.log("Filtered Sources " + JSON.stringify(sources))
        if(allowedList.length != 0){
            sources = _.intersection(sources,allowedList)
        }

        return sources


}

async function get_translation(englishText, targetLang,req){

    console.log("get_translation:", targetLang, "InputText: ", englishText);
    if (targetLang === 'en') {
        console.log("get_translation: target is en, translation not required. Return english text");
        return englishText;
    }

    const translateClient = new AWS.Translate();
    try {
        var customTerminologyEnabled = _.get(req._settings,"ENABLE_CUSTOM_TERMINOLOGY") == true;
        var customTerminologies = _.get(req._settings,"CUSTOM_TERMINOLOGY_SOURCES","").split(",");
        console.log("get translation request " + JSON.stringify(req))

        const params = {
            SourceLanguageCode: 'en', /* required */
            TargetLanguageCode: targetLang, /* required */
            Text: englishText, /* required */
        };
        if(customTerminologyEnabled){
            customTerminologies = await get_terminologies("en",customTerminologies)

            if(customTerminologies.length == 0){
                console.log("Warning: ENABLE_CUSTOM_TERMINOLOGY is set to true, but no entries found for CUSTOM_TERMINOLOGY_SOURCES ")
            }else{
                params["TerminologyNames"] = customTerminologies;
            }
        }
    
        console.log("input text:", englishText);
        const translation = await translateClient.translateText(params).promise();
        console.log("translation:", translation);
        return translation.TranslatedText;
    } catch (err) {
        console.log("warning - error during translation: ", err);
        return englishText;
    }
}

function escapeRegExp(string) {
    return string.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

function replaceAll(str, find, replace) {
    return str.replace(new RegExp(escapeRegExp(find), 'g'), replace);
}

exports.translate_hit = async function(hit,usrLang,req){
    console.log("translate_hit:", JSON.stringify(hit,null,2));
    let hit_out = _.cloneDeep(hit);
    let a = _.get(hit, "a");
    let markdown = _.get(hit, "markdown");
    let ssml = _.get(hit, "ssml");
    let r = _.get(hit, "r");
    // catch and log errors before throwing exception.
    if (a) {
        try {
            hit_out.a = await get_translation(hit_out.a, usrLang,req);
        } catch (e) {
            console.log("ERROR: Answer caused Translate exception: ", a)
            throw (e);
        }
    }
    if (markdown) {
        try {
            const res = await get_translation(hit_out.markdown, usrLang,req);
            hit_out.markdown  = replaceAll(res,'] (http', '](http');
        } catch (e) {
            console.log("ERROR: Markdown caused Translate exception: ", a)
            throw (e);
        }
    }
    if (ssml) {
        try {
            hit_out.ssml = await get_translation(hit_out.ssml, usrLang,req);
        } catch (e) {
            console.log("ERROR: SSML caused Translate exception: ", a);
            throw (e);
        }
    }

    console.log("Preprocessed Result: ", hit_out);
    return hit_out;    
};
