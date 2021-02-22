const Promise = require('bluebird')
const _ = require('lodash')
const AWS = require('aws-sdk');

async function get_userLanguages(inputText) {
    const params = {
        Text: inputText /* required */
    };
    const comprehendClient = new AWS.Comprehend();
    const languages = comprehendClient.detectDominantLanguage(params).promise();
    return languages;
}

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

async function get_translation(inputText, sourceLang, targetLang,req ) {
    var customTerminologyEnabled = _.get(req._settings,"ENABLE_CUSTOM_TERMINOLOGY") == true;
    var customTerminologies = _.get(req._settings,"CUSTOM_TERMINOLOGY_SOURCES","").split(",");
    console.log("get translation request " + JSON.stringify(inputText))


    const params = {
        SourceLanguageCode: sourceLang, /* required */
        TargetLanguageCode: targetLang, /* required */
        Text: inputText, /* required */
    };
    console.log("get_translation:", targetLang, "InputText: ", inputText);
    if (targetLang === sourceLang) {
        console.log("get_translation: source and target are the same, translation not required." + inputText);
        return inputText;
    }
    if(customTerminologyEnabled){


        console.log("Custom terminology enabled")
        customTerminologies = await get_terminologies(sourceLang,customTerminologies)
        if(customTerminologies.length == 0){
            console.log("Warning: ENABLE_CUSTOM_TERMINOLOGY is set to true, but no matching entries found for CUSTOM_TERMINOLOGY_SOURCES ")
        }else{
            console.log("Using custom terminologies " + JSON.stringify(customTerminologies))
            params["TerminologyNames"] = customTerminologies;
        }
    }

    const translateClient = new AWS.Translate();
    try {
        console.log("Fullfilment params " + JSON.stringify(params))
        const translation = await translateClient.translateText(params).promise();
        console.log("Translation response " + JSON.stringify(translation))
        return translation.TranslatedText;
    } catch (err) {
        console.log("warning - error during translation. Returning: " + inputText);
        return inputText;
    }
}

function set_userLocale(Languages, userPreferredLocale, defaultConfidenceScore, req) {
    let locale = '';
    let userDetectedLocaleConfidence = Languages.Languages[0].Score;
    let userDetectedLocale = Languages.Languages[0].LanguageCode;
    let isPreferredLanguageDetected = false;
    let i = 0;
    let userDetectedSecondaryLocale;

    console.log("preferred lang", userPreferredLocale);
    for (i = 0; i <= Languages.Languages.length - 1; i++) {
        console.log("found lang: " + Languages.Languages[i].LanguageCode);
        console.log("score: " + Languages.Languages[i].Score);
        if (Languages.Languages[i].LanguageCode === userPreferredLocale) {
            isPreferredLanguageDetected = true;
            userDetectedLocale = Languages.Languages[i].LanguageCode;
        }
        if (i > 0 && Languages.Languages[i].LanguageCode !== 'en' && userDetectedSecondaryLocale === undefined) {
            userDetectedSecondaryLocale = Languages.Languages[i].LanguageCode;
        }
    }
    console.log("isPreferredLanguageDetected", isPreferredLanguageDetected);
    console.log("detected locale", userDetectedLocale);
    console.log("detected secondary locale", userDetectedSecondaryLocale);
    console.log("detected Confidence", userDetectedLocaleConfidence);

    _.set(req.session, "userDetectedLocale", userDetectedLocale);
    _.set(req.session, "userDetectedLocaleConfidence", userDetectedLocaleConfidence);
    if (userDetectedSecondaryLocale) {
        _.set(req.session, "userDetectedSecondaryLocale", userDetectedSecondaryLocale);
    } else {
        if (req.session.userDetectedSecondaryLocale) delete req.session.userDetectedSecondaryLocale;
    }

    if (userPreferredLocale && userDetectedLocale !== '') {
        locale = userPreferredLocale;
        console.log("set user preference as language to use: ", locale);
    } else if ((userPreferredLocale === undefined || userPreferredLocale === '') && userDetectedLocaleConfidence <= defaultConfidenceScore) {
        locale = 'en'; // default to english
        console.log("Detected language confidence too low, defaulting to English");
    } else {
        locale = userDetectedLocale;
        console.log("set detected language as language to use: ", locale);
    }
    return locale;
}

async function set_translated_transcript(locale, req) {
    const SessionAttributes = _.get(req, 'session');
    const detectedLocale = SessionAttributes.userDetectedLocale;
    const detectedSecondaryLocale = SessionAttributes.userDetectedSecondaryLocale;

    if ( ! req.question.toLowerCase().startsWith("qid::")) {
        if (locale === 'en' && detectedLocale === 'en' && detectedSecondaryLocale === undefined) {
            console.log("No translation - english detected");
        } else if (locale === 'en' && detectedLocale === 'en' && detectedSecondaryLocale) {
            console.log("translate to english using secondary detected locale:  ", req.question);
            const translation = await get_translation(req.question, detectedSecondaryLocale, 'en',req);

            _.set(req, "_translation", translation);
            _.set(req, "question", translation);
            console.log("Overriding input question with translation: ", req.question);
        }  else if (locale !== '' && locale.charAt(0) !== '%' && detectedLocale && detectedLocale !== '') {
            console.log("Confidence in the detected language high enough.");
            const translation = await get_translation(req.question, detectedLocale, 'en',req);

            _.set(req, "_translation", translation);
            _.set(req, "question", translation);
            console.log("Overriding input question with translation: ", req.question);
        }  else {
            console.log ('not possible to perform language translation')
        }
    } else {
        console.log("Question targeting specified Qid (starts with QID::) - skip translation");
    }

}

exports.set_multilang_env = async function (req) {
    // Add QnABot settings for multilanguage support
    console.log("Entering multilanguage Middleware");
    console.log("req:", req);

    let userLocale = '';
    const defaultConfidenceScore = req._settings.MINIMUM_CONFIDENCE_SCORE;
    const userLanguages = await get_userLanguages(req.question);
    const userPreferredLocale = req.session.userPreferredLocale ? req.session.userPreferredLocale : '';
    userLocale = set_userLocale(userLanguages, userPreferredLocale, defaultConfidenceScore, req);
    _.set(req.session, "userLocale", userLocale);
    _.set(req._event, "origQuestion", req.question);
    await set_translated_transcript(userLocale, req);

    return req;
}


exports.translateText = async function (inputText, sourceLang, targetLang,req) {
    const res = await get_translation(inputText, sourceLang, targetLang,req);
    return res.TranslatedText;
}

