const aws = require('aws-sdk');

//start connection
var _ = require('lodash');
var Handlebars = require('handlebars');
var supportedLanguages = require('./supportedLanguages');

console.log("SUPPORTED lang: ", supportedLanguages.getSupportedLanguages());

var res_glbl = {};
var req_glbl = {};
var autotranslate;

// used by signS3Url helper
function signS3URL(url, expireSecs) {
    var bucket, key; 
    if (url.search(/\/s3[.-](\w{2}-\w{4,9}-\d\.)?amazonaws\.com/) != -1) {
      //bucket in path format
      bucket = url.split('/')[3];
      key = url.split('/').slice(4).join('/');
    }
    if (url.search(/\.s3[.-](\w{2}-\w{4,9}-\d\.)?amazonaws\.com/) != -1) {
      //bucket in hostname format
      let hostname = url.split("/")[2];
      bucket = hostname.split(".")[0];
      key = url.split('/').slice(3).join('/');
    }
    if (bucket && key) {
        console.log("Attempt to convert S3 url to a signed URL: ",url);
        console.log("Bucket: ", bucket, " Key: ", key) ;
        try {
            const s3 = new aws.S3() ;
            const signedurl = s3.getSignedUrl('getObject', {
                Bucket: bucket,
                Key: key,
                Expires: expireSecs
            });
            //console.log("Signed URL: ", signedurl);
            url = signedurl;
        } catch (err) {
              console.log("Error signing S3 URL (returning original URL): ", err) ;
        }
    } else {
        console.log("URL is not an S3 url - return unchanged: ",url);
    }   
    return url;
}

Handlebars.registerHelper('ifCond', function (v1, operator, v2, options) {
    switch (operator) {
        case '==':
            return (v1 == v2) ? options.fn(this) : options.inverse(this);
        case '===':
            return (v1 === v2) ? options.fn(this) : options.inverse(this);
        case '!=':
            return (v1 != v2) ? options.fn(this) : options.inverse(this);
        case '!==':
            return (v1 !== v2) ? options.fn(this) : options.inverse(this);
        case '<':
            return (v1 < v2) ? options.fn(this) : options.inverse(this);
        case '<=':
            return (v1 <= v2) ? options.fn(this) : options.inverse(this);
        case '>':
            return (v1 > v2) ? options.fn(this) : options.inverse(this);
        case '>=':
            return (v1 >= v2) ? options.fn(this) : options.inverse(this);
        case '&&':
            return (v1 && v2) ? options.fn(this) : options.inverse(this);
        case '||':
            return (v1 || v2) ? options.fn(this) : options.inverse(this);
        default:
            return options.inverse(this);
    }
});

Handlebars.registerHelper('ifLang', function (lang, options) {
    const SessionAttributes = _.get(req_glbl, 'session');
    const usrLang = SessionAttributes.userLocale;
    if (usrLang && lang === usrLang) {
        _.set(req_glbl.session, 'matchlang', 'true');
        // Disable autotranslation, since we have an explicit language match
        autotranslate = false;
        return options.fn(this);
    }
});

Handlebars.registerHelper('defaultLang', function (options) {
    var SessionAttributes = _.get(req_glbl, 'session');
    let previousMatchLang = SessionAttributes.matchlang;

    if (previousMatchLang && previousMatchLang === 'true' ) {
        // case one. Hitting the default en lang response and a previous lang has matched. Return nothing and reset matchlang
        // matchlang to false for next processing. Disable autotranslation.
        _.set(req_glbl.session, 'matchlang', 'false');
        autotranslate = false;
        return options.inverse(this);
    } else if (previousMatchLang && previousMatchLang === 'false' ) {
        // case two. Hitting the default lang response and a previous lang has NOT matched. Return value. matchlang is
        // false for next processing. Enable autotranslation.
        autotranslate = true;
        return options.fn(this);
    } else if (previousMatchLang === undefined) {
        // case three. Hitting the default lang response and no previous lang has been encountered. Return default value
        // but set matchlang to false for next processing. Enable autotranslation.
        _.set(req_glbl.session, 'matchlang', 'false');
        autotranslate = true;
        return options.fn(this);
    } else {
        if (previousMatchLang === undefined) {
            _.set(req_glbl.session, 'matchlang', 'false');
        }
        return options.inverse(this);
    }
});

Handlebars.registerHelper('setLang', function (lang, last, options) {
    if (_.get(req_glbl._settings, 'ENABLE_MULTI_LANGUAGE_SUPPORT')) {
        const userPreferredLocaleKey = 'session.userPreferredLocale';
        const userLocaleKey = 'session.userLocale';
        const currentPreferredLocale = _.get(res_glbl, userPreferredLocaleKey);
        const currentUserLocale = _.get(res_glbl, userLocaleKey);
        const errorLocale = currentPreferredLocale ? currentPreferredLocale : (currentUserLocale ? currentUserLocale : "en");
        const capitalize = (s) => {
            if (typeof s !== 'string') return ''
            return s.charAt(0).toUpperCase() + s.slice(1)
        };
        var errorFound = _.get(req_glbl._event, 'errorFound')
        var userLanguage = capitalize(_.get(req_glbl._event, 'inputTranscript'));
        var supported_languages = supportedLanguages.getSupportedLanguages();
        var languageErrorMessages = supportedLanguages.getLanguageErrorMessages();
        var userLanguageCode = supported_languages[userLanguage];

        if (userLanguageCode === undefined && !errorFound) {
            console.log("no language mapping for user utterance");
            _.set(req_glbl._event, 'errorFound', true);
            return languageErrorMessages[errorLocale].errorMessage;
        }

        if (userLanguageCode && lang == userLanguageCode) {
            console.log("setting: ", options.fn(this));
            console.log("Setting req & res session attribute:", "session.userPreferredLocale", " Value:", userLanguageCode);
            _.set(res_glbl, userPreferredLocaleKey, userLanguageCode);
            _.set(req_glbl, userPreferredLocaleKey, userLanguageCode);
            _.set(res_glbl, userLocaleKey, userLanguageCode);
            _.set(req_glbl, userLocaleKey, userLanguageCode);
            return options.fn(this);
        } else if ((last === true) && (_.get(res_glbl, userPreferredLocaleKey) !== userLanguageCode) && !errorFound) {
            return languageErrorMessages[errorLocale].errorMessage;
        } else {
            return "";
        }
    } else {
        console.log("Warning - attempt to use setLang handlebar helper function while ENABLE_MULTI_LANGUAGE_SUPPORT is set to false. Please check configuration.");
    }
});

Handlebars.registerHelper('setSessionAttr', function () {
    let args = Array.from(arguments);
    const k = args[0];
    // concat remaining arguments to create value
    const v_arr = args.slice(1, args.length - 1); // ignore final 'options' argument
    const v = v_arr.join(""); // concatenate value arguments 
    console.log("Setting res session attribute:", k, " Value:", v);
    _.set(res_glbl.session, k, v);
    return "";
});

Handlebars.registerHelper('getSessionAttr', function (attr, def, options) {
    let v = _.get(res_glbl.session, attr, def);
    console.log("Return session attribute key, value: ", attr, v);
    return v;
});

Handlebars.registerHelper('signS3URL', function (s3url, options) {
    let signedUrl = signS3URL(s3url, 300) ;
    console.log("Return signed S3 URL: ", signedUrl);
    // return SafeString to prevent unwanted url escaping
    return new Handlebars.SafeString(signedUrl);
});

Handlebars.registerHelper('randomPick', function () {
    var argcount = arguments.length - 1;  // ignore final 'options' argument
    console.log("Select randomly from ", argcount, "inputs: ", arguments);
    var item = arguments[Math.floor(Math.random() * argcount)];
    console.log("Selected: ", item);
    return item;
});

var apply_handlebars = async function (req, res, hit) {
    console.log("apply handlebars");
    console.log('req is: ' + JSON.stringify(req,null,2));
    console.log('res is: ' + JSON.stringify(res,null,2));
    res_glbl = res; // shallow copy - allow modification by setSessionAttr helper
    req_glbl = req; // shallow copy - allow sessionAttributes retrieval by ifLang helper
    _.set(req_glbl._event, 'errorFound', false);
    var context = {
        LexOrAlexa: req._type,
        ClientType: req._clientType,
        UserInfo: req._userInfo,
        SessionAttributes: _.get(res, 'session'),
        Settings: req._settings,
        Question: req.question,
        OrigQuestion: _.get(req,"_event.origQuestion",req.question),
        PreviousQuestion: _.get(req, "session.qnabotcontext.previous.q", false),
        Sentiment: req.sentiment,
    };
    // Autotranslation enabled by default.. will be disabled when handlebars finds explicit language match block.
    autotranslate = true;
    console.log("Apply handlebars preprocessing to ES Response. Context: ", context);
    var hit_out = _.cloneDeep(hit);
    var a = _.get(hit, "a");
    var markdown = _.get(hit, "alt.markdown");
    var ssml = _.get(hit, "alt.ssml");
    var rp = _.get(hit, "rp", _.get(req, '_settings.DEFAULT_ALEXA_REPROMPT'));
    var r = _.get(hit, "r");

    // catch and log errors before throwing exception.
    if (a) {
        try {
            const a_template = Handlebars.compile(a);
            hit_out.a=a_template(context);
            if (autotranslate){
                _.set(hit_out, 'autotranslate.a', true);
            } 
        } catch (e) {
            console.log("ERROR: Answer caused Handlebars exception. Check syntax: ", a)
            throw (e);
        }
    }
    if (markdown) {
        try {
            var markdown_template = Handlebars.compile(markdown);
            hit_out.alt.markdown = markdown_template(context);
            if (autotranslate){
                _.set(hit_out, 'autotranslate.alt.markdown', true);
            } 
        } catch (e) {
            console.log("ERROR: Markdown caused Handlebars exception. Check syntax: ", markdown)
            throw (e);
        }
    }
    if (ssml) {
        try {
            var ssml_template = Handlebars.compile(ssml);
            hit_out.alt.ssml = ssml_template(context);
            if (autotranslate){
                _.set(hit_out, 'autotranslate.alt.ssml', true);
            } 
        } catch (e) {
            console.log("ERROR: SSML caused Handlebars exception. Check syntax: ", ssml)
            throw (e);
        }
    }
    if (rp) {
        try {
            var rp_template = Handlebars.compile(rp);
            hit_out.rp = rp_template(context);
            if (autotranslate){
                _.set(hit_out, 'autotranslate.rp', true);
            } 
        } catch (e) {
            console.log("ERROR: reprompt caused Handlebars exception. Check syntax: ", rp)
            throw (e);
        }
    }
    if (r) {
        try {
            if (r.subTitle && r.subTitle.length > 0) {
                var subTitle_template = Handlebars.compile(r.subTitle);
                hit_out.r.subTitle = subTitle_template(context);
                if (autotranslate){
                    _.set(hit_out, 'autotranslate.r.subTitle', true);
                } 
            }
            if (r.title && r.title.length > 0) {
                var title_template = Handlebars.compile(r.title);
                hit_out.r.title = title_template(context);
                if (autotranslate){
                    _.set(hit_out, 'autotranslate.r.title', true);
                } 
            }
            if (r.text && r.text.length > 0) {
                var text_template = Handlebars.compile(r.text);
                hit_out.r.text = text_template(context);
            }
            if (r.imageUrl && r.imageUrl.length > 0) {
                var imageUrl_template = Handlebars.compile(r.imageUrl);
                hit_out.r.imageUrl = imageUrl_template(context);
            }
            if (r.url && r.url.length > 0) {
                var url_template = Handlebars.compile(r.url);
                hit_out.r.url = url_template(context);
            }
            if (r.buttons && r.buttons.length > 0) {
                for (let x=0; x<r.buttons.length; x++) {
                    var b_text_template = Handlebars.compile(r.buttons[x].text);
                    hit_out.r.buttons[x].text = b_text_template(context);
                    if (r.buttons[x].text.length > 0 && autotranslate){
                        _.set(hit_out, 'autotranslate.r.buttons[x].text', true);
                    } 
                    var b_value_template = Handlebars.compile(r.buttons[x].value);
                    hit_out.r.buttons[x].value = b_value_template(context);
                    if (r.buttons[x].value.length > 0 && autotranslate){
                        _.set(hit_out, 'autotranslate.r.buttons[x].value', true);
                    }
                }
            }
        } catch (e) {
            console.log("ERROR: response card fields format caused Handlebars exception. Check syntax: " + e );
            throw (e);
        }
    }
    console.log("Preprocessed Result: ", hit_out);
    return hit_out;
}

module.exports = async function (req, res, es_hit) {
    console.log("entering apply_handlebars");
    return await apply_handlebars(req, res, es_hit);
};
