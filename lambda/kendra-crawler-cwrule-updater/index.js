const AWS = require("aws-sdk");
const _ = require("lodash");

function isJson(str) {
  try {
    JSON.parse(str);
  } catch (e) {
    return false;
  }
  return true;
}

async function retry(count, func) {
  var retryCount = 0;
  var error = {};
  while (retryCount < count) {
    try {
      return await func();
    } catch (err) {
      error = err;
      if (err.retryable !== undefined && err.retryable === true) {
        console.log(`retrying error:` + JSON.stringify(err));
        retryCount++;
        await sleep(3000);
      } else {
        break;
      }
    }
  }
  throw error;
}

function str2bool(settings) {
  var new_settings = _.mapValues(settings, (x) => {
    if (_.isString(x)) {
      x = x.replace(/^"(.+)"$/, "$1"); // remove wrapping quotes
      if (x.toLowerCase() === "true") {
        return true;
      }
      if (x.toLowerCase() === "false") {
        return false;
      }
    }
    return x;
  });
  return new_settings;
}
/**
 * Function to get parameters from QnABot settings
 * @param param_name
 * @returns {*}
 */
async function get_parameter(param_name) {
  var ssm = new AWS.SSM();
  var params = {
    Name: param_name,
    WithDecryption: true,
  };
  // TODO: update permissions
  var response = await ssm.getParameter(params).promise();
  var settings = response.Parameter.Value;
  if (isJson(settings)) {
    settings = JSON.parse(response.Parameter.Value);
    settings = str2bool(settings);
  }
  return settings;
}

/**
 * Function to retrieve QnABot settings
 * @returns {*}
 */
async function get_settings() {
  var default_settings_param = process.env.DEFAULT_SETTINGS_PARAM;
  var custom_settings_param = process.env.CUSTOM_SETTINGS_PARAM;

  console.log(
    "Getting Default QnABot settings from SSM Parameter Store: ",
    default_settings_param
  );
  var default_settings = await get_parameter(default_settings_param);

  console.log(
    "Getting Custom QnABot settings from SSM Parameter Store: ",
    custom_settings_param
  );
  var custom_settings = await get_parameter(custom_settings_param);

  var settings = _.merge(default_settings, custom_settings);
  _.set(settings, "DEFAULT_USER_POOL_JWKS_URL");

  console.log("Merged Settings: ", settings);

  return settings;
}

async function updateCloudWatchEvent(ruleName, settings) {
  var cloudwatchevents = new AWS.CloudWatchEvents();
  var assignedRules;
  var rule = await cloudwatchevents.describeRule({ Name: ruleName }).promise();
  var currentState = settings.ENABLE_KENDRA_WEB_INDEXER
    ? "ENABLED"
    : "DISABLED";
  console.log(
    `RuleName ${ruleName} KENDRA_INDEXER_SCHEDULE ${
      settings.KENDRA_INDEXER_SCHEDULE
    } settings State ${currentState}`
  );
  console.log(
    `RuleName ${ruleName} current schedule        ${
      rule.ScheduleExpression
    } current state  ${rule.State}`
  );
  if (settings.KENDRA_INDEXER_SCHEDULE != "") {
    //only allow rate() syntax because that is easy to parse and put guard rails around
    if (
      !(
        settings.KENDRA_INDEXER_SCHEDULE.startsWith("rate(") &&
        settings.KENDRA_INDEXER_SCHEDULE.endsWith(")")
      )
    ) {
      throw "KENDRA_INDEXER_SCHEDULE must use CloudWatch rate() format -- see https://docs.aws.amazon.com/AmazonCloudWatch/latest/events/ScheduledEvents.html#RateExpressions";
    }
    var timeParts = settings.KENDRA_INDEXER_SCHEDULE.replace("rate(", "")
      .replace(")", "")
      .split(" ");
    console.log("parts " + JSON.stringify(timeParts));
    if (timeParts.length != 2) {
      throw "Invalid schedule format.  See https://docs.aws.amazon.com/AmazonCloudWatch/latest/events/ScheduledEvents.html#RateExpressions for valid expressions";
    }
    validUnits = ["hour", "hours", "day", "days"];
    if (!validUnits.includes(timeParts[1])) {
      throw "Kendra Indexer only supports hours and days";
    }
    if (parseInt(timeParts[0]) != timeParts[0]) {
      throw "Only integer values are supported";
    }

    if (
      rule.ScheduleExpression != settings.KENDRA_INDEXER_SCHEDULE ||
      rule.State != currentState
    ) {
      console.log(`Updating rule ${ruleName}`);
      var params = {
        Name: rule.Name,
        Description: rule.Description,
        ScheduleExpression: settings.KENDRA_INDEXER_SCHEDULE,
        State: currentState,
      };
      let result = await cloudwatchevents.putRule(params).promise();
      console.log("Rule Updated " + JSON.stringify(result));
    
    }
  }else {
    let result = await cloudwatchevents.putRule(
       {Name: ruleName,
        ScheduleExpression: "rate(30 days)", //A rate has to be specified
        State:"DISABLED"}).promise();
    console.log("Rule Updated " + JSON.stringify(result));
  }
}

exports.handler = async (event, context, callback) => {
  pageCount = 0;
  console.log("Incoming event " + JSON.stringify(event));

  try {
    var settings = await get_settings();
    var kendraIndexId = settings.KENDRA_WEB_PAGE_INDEX;

    if (event["detail-type"] == "Parameter Store Change") {
      await updateCloudWatchEvent(process.env.CLOUDWATCH_RULENAME, settings);
      return;
    }
    return;
  } catch (err) {
    console.log(err);
    throw err;
  }
};
