const chromium = require("chrome-aws-lambda");
const AWS = require("aws-sdk");
const crypto = require("crypto");
const _ = require("lodash");
const sleep = require("util").promisify(setTimeout);
const https = require("https");
const pdfreader = require("pdfreader");

AWS.config.update({ region: "us-east-1" });

/**
 * Function to check if a string has a JSON structure
 * @param str
 * @returns boolean
 */
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

var browser = null;
var page = null;
var pageCount = 0;
async function getPage(url) {
  let result = null;
  let page = {};
  try {
    if (browser == null || page == null) {
      browser = await chromium.puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath,
        headless: chromium.headless,
        ignoreHTTPSErrors: true,
      });
      page = await browser.newPage();
    }

    await page.goto(url);

    return {
      Page: page,
      Browser: browser,
    };
  } catch (error) {
    console.log("Warning:" + error);
    console.log("Resetting browser context");
    try {
      page.Browser.close();
    } catch {}
  } finally {
    browser = null;
  }
}

async function createKendraDocument(page, jobExecutionId, dataSourceId) {
  var url = await page.url();
  var pageText = await page.content();
  console.log("Creating document for....");
  console.log(url);

  doc = {
    Id: crypto
      .createHash("sha1")
      .update(url)
      .digest("base64"),
    Blob: pageText,
    ContentType: "HTML",
    Title: await page.title(),
    Attributes: [
      {
        Key: "_data_source_id",
        Value: {
          StringValue: dataSourceId,
        },
      },
      {
        Key: "_data_source_sync_job_execution_id",
        Value: {
          StringValue: jobExecutionId,
        },
      },
      {
        Key: "_source_uri",
        Value: {
          StringValue: url,
        },
      },
      {
        Key: "_created_at",
        Value: {
          DateValue: Date.now(),
        },
      },
    ],
  };
  return doc;
}

async function bufferize(url) {
  var hn = url.substring(url.search("//") + 2);
  hn = hn.substring(0, hn.search("/"));
  var pt = url.substring(url.search("//") + 2);
  pt = pt.substring(pt.search("/"));
  const options = { hostname: hn, port: 443, path: pt, method: "GET" };
  return new Promise(function(resolve, reject) {
    var buff = new Buffer.alloc(0);
    const req = https.request(options, (res) => {
      res.on("data", (d) => {
        buff = Buffer.concat([buff, d]);
      });
      res.on("end", () => {
        resolve(buff);
      });
    });
    req.on("error", (e) => {
      console.error("https request error: " + e);
    });
    req.end();
  });
}

async function readlines(buffer, xwidth) {
  return new Promise((resolve, reject) => {
    var pdftxt = new Array();
    var pg = 0;
    new pdfreader.PdfReader().parseBuffer(buffer, function(err, item) {
      if (err) console.log("pdf reader error: " + err);
      else if (!item) {
        pdftxt.forEach(function(a, idx) {
          pdftxt[idx].forEach(function(v, i) {
            pdftxt[idx][i].splice(1, 2);
          });
        });
        resolve(pdftxt);
      } else if (item && item.page) {
        pg = item.page - 1;
        pdftxt[pg] = [];
      } else if (item.text) {
        var t = 0;
        var sp = "";
        pdftxt[pg].forEach(function(val, idx) {
          if (val[1] == item.y) {
            if (xwidth && item.x - val[2] > xwidth) {
              sp += " ";
            } else {
              sp = "";
            }
            pdftxt[pg][idx][0] += sp + item.text;
            t = 1;
          }
        });
        if (t == 0) {
          pdftxt[pg].push([item.text, item.y, item.x]);
        }
      }
    });
  });
}
async function createKendraDocumentFromPDF(url, jobExecutionId, dataSourceId) {
  var pageText = await getTextFromPDF(url);
  console.log("Creating document for " + url);
  console.log(pageText);
  doc = {
    Id: crypto
      .createHash("sha1")
      .update(url)
      .digest("base64"),
    Blob: pageText,
    ContentType: "PLAIN_TEXT",
    Title: url.split("/").slice(-1)[0],
    Attributes: [
      {
        Key: "_data_source_id",
        Value: {
          StringValue: dataSourceId,
        },
      },
      {
        Key: "_data_source_sync_job_execution_id",
        Value: {
          StringValue: jobExecutionId,
        },
      },
      {
        Key: "_source_uri",
        Value: {
          StringValue: url,
        },
      },
      {
        Key: "_created_at",
        Value: {
          DateValue: Date.now(),
        },
      },
    ],
  };
  return doc;
}

async function getTextFromPDF(url) {
  var pdfBuffer = await bufferize(url);
  var pdfParagraphs = await readlines(pdfBuffer);
  console.log(JSON.stringify(pdfParagraphs));
  var allLines = pdfParagraphs.flat(5);
  return allLines.join("\n");
}

async function getDataSourceIdFromDataSourceName(
  kendraIndexId,
  dataSourceName
) {
  if (!kendraIndexId) {
    return undefined;
  }
  var kendra = new AWS.Kendra();
  console.log(
    `Finding datasourceId for ${dataSourceName} for IndexID ${kendraIndexId}`
  );
  try {
    var foundDataSourceIds = (await retry(
      3,
      async () =>
        await kendra.listDataSources({ IndexId: kendraIndexId }).promise()
    )).SummaryItems.filter((s) => s.Name == dataSourceName).map((m) => m.Id);
  } catch (err) {
    if (err.statusCode == 400) {
      return {
        Error: `Kendra IndexId ${kendraIndexId} Not Found`,
      };
    }
    throw err;
  }
  if (!foundDataSourceIds) {
    return {
      Error: `NOTCREATED`,
      DataSourceId: ``,
    };
  }
  return {
    Error: "",
    DataSourceId: foundDataSourceIds[0],
  };
}
async function startKendraSync(kendraIndexId, name, forceSync = false) {
  var kendra = new AWS.Kendra();
  var dataSourceId;
  var params = {
    IndexId: kendraIndexId /* required */,
  };
  console.log(
    `Starting Kendra sync for IndexId ${kendraIndexId} DataSource Name ${name}`
  );
  var result = await getDataSourceIdFromDataSourceName(kendraIndexId, name);
  if (result.Error) {
    throw result.Error;
  }
  var foundDataSourceId = result.DataSourceId;
  console.log(`Found datasourceId ${foundDataSourceId}`);
  if (!foundDataSourceId) {
    var params = {
      IndexId: kendraIndexId,
      Name: name,
      Type: "CUSTOM",
    };
    console.log(`${name} doesn't exist.  Creating it....`);
    var createResponse = await kendra.createDataSource(params).promise();
    dataSourceId = createResponse.Id;
  } else {
    dataSourceId = foundDataSourceId;
  }
  console.log("Getting sync Job status");
  var status = await getSyncJobStatus(kendraIndexId, dataSourceId);

  if (status.Status != "COMPLETE" && !forceSync) {
    throw `A sync job is currently running for the data source ${name} Id ${dataSourceId}`;
  }

  var params = {
    Id: dataSourceId /* required */,
    IndexId: kendraIndexId /* required */,
  };
  console.log("Starting DataSourceSyncJob");
  var syncResponse = await kendra.startDataSourceSyncJob(params).promise();
  return {
    ExecutionId: syncResponse.ExecutionId,
    DataSourceId: dataSourceId,
  };
}

async function stopSyncJob(kendraIndexId, dataSourceName) {
  var kendra = new AWS.Kendra();

  var result = await getDataSourceIdFromDataSourceName(
    kendraIndexId,
    dataSourceName
  );
  if (result.Error) {
    throw result.Error;
  }
  var indexId = result.DataSourceId;
  console.log(`Stop syncing Datasource ${dataSourceName}:${indexId}`);
  var status = await getSyncJobStatus(kendraIndexId, indexId);
  if (status.Status == "PENDING") {
    console.log(
      `Stopping data source ${indexId} on Kendra Index ${kendraIndexId}`
    );
    kendra.stopDataSourceSyncJob({
      Id: indexId,
      IndexId: kendraIndexId,
    });
  }
}

async function putDocuments(kendraIndexId, dataSourceId, documents) {
  try {
    var kendra = new AWS.Kendra();
    console.log(
      "documents => " +
        JSON.stringify(
          documents.map((d) => {
            return {
              DocumentID: d.Id,
              Title: d.Title,
            };
          })
        )
    );
    for (var i = 0; i < documents.length; i += 10) {
      //batchPutDocuments can't handle more than 10 documents
      var end = documents.length ? i + 10 : documents.length - 1;
      console.log(`Putting documents ${i} to ${end} in ${dataSourceId}`);
      var batchPutDocumentResponse = await kendra
        .batchPutDocument({
          Documents: documents.slice(i, end),
          IndexId: kendraIndexId,
        })
        .promise();
    }
    //TODO: Add error handling
    return batchPutDocumentResponse;
  } finally {
    await kendra
      .stopDataSourceSyncJob({
        Id: dataSourceId,
        IndexId: kendraIndexId,
      })
      .promise();
  }
}

async function getSyncJobStatus(kendraIndexId, dataSourceId, executionId) {
  var kendra = new AWS.Kendra();
  try {
    var syncJobResult = await retry(
      3,
      async () =>
        await kendra
          .listDataSourceSyncJobs({
            Id: dataSourceId,
            IndexId: kendraIndexId,
          })
          .promise()
    );
    if (executionId) {
      var executionSyncJobs = syncJobResult["History"].filter(
        (h) => h.ExecutionId == executionId
      );
      if (executionSyncJobs.length != 1) {
        return {
          Status: "",
          ErrorMessage: "",
          StartTime: "",
          ExecutionId: "",
        };
      }
      var errorMessage = "";
      if (status != "SUCCEEDED") {
        errorMessage = currentStatus[0].ErrorMessage;
      }
      return {
        Status: executionSyncJobs[0].Status,
        ErrorMessage: errorMessage,
      };
    }
    console.log("SyncJobHistory");
    console.log(JSON.stringify(syncJobResult["History"]));
    var dataSourceSyncJob = syncJobResult["History"].sort((a, b) =>
      a.StartTime > b.StartTime ? -1 : 1
    )[0];
    var pendingStatus = [
      "SYNCING",
      "INCOMPLETE",
      "STOPPING",
      "SYNCING_INDEXING",
    ];
    if (!dataSourceSyncJob) {
      return {
        Status: "NOTINDEXED",
        ErrorMessage: "",
        StartTime: "n/a",
        ExecutionId: "",
      };
    }
    if (pendingStatus.includes(dataSourceSyncJob.Status)) {
      return {
        Status: "PENDING",
        ErrorMessage: "",
        StartTime: dataSourceSyncJob.StartTime,
        ExecutionId: dataSourceSyncJob.ExecutionId,
      };
    } else {
      return {
        Status: dataSourceSyncJob.Status,
        StartTime: dataSourceSyncJob.StartTime,
        ErrorMessage: "",
      };
    }
  } catch (err) {
    console.log(`error retrieving status ${err}`);
    return {
      Status: "Unknown",
      StartTime: "",
      ErrorMessage: err,
    };
  }
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
    var result = await cloudwatchevents.putRule(params).promise();
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
    if (event["path"] == "/crawler/status") {
      if (!kendraIndexId) {
        return {
          statusCode: 200,
          body: JSON.stringify({ Status: "INDEX_NOT_SPECIFIED" }),
          isBase64Encoded: false,
        };
      }
      var result = await getDataSourceIdFromDataSourceName(
        kendraIndexId,
        process.env.DATASOURCE_NAME
      );
      if (result.Error) {
        return {
          statusCode: 200,
          body: JSON.stringify({ Status: result.Error }),
          isBase64Encoded: false,
        };
      }

      var syncStatus = await getSyncJobStatus(kendraIndexId, result.DataSourceId);
      return {
        statusCode: 200,
        body: JSON.stringify(syncStatus),
        isBase64Encoded: false,
      };
    }
    if (event["path"] == "/crawler/stop") {
      console.log("Stopping Sync for " + kendraIndexId);
      await stopSyncJob(kendraIndexId, process.env.DATASOURCE_NAME);
      return {
        statusCode: 200,
        body: JSON.stringify({ Status: "SUCCESS" }),
        isBase64Encoded: false,
      };
    }

    // Run Crawler....
    if (!kendraIndexId) {
      throw "KENDRA_WEB_PAGE_INDEX was not specified in settings";
    }
    var urls = settings.KENDRA_INDEXER_URLS.split(",");
    await updateCloudWatchEvent(process.env.CLOUDWATCH_RULENAME, settings);
    await indexPages(kendraIndexId, process.env.DATASOURCE_NAME, urls, true);
    return;
  } catch (err) {
    console.log(err);
    throw err;
  }
};

async function indexPages(
  kendraIndexId,
  dataSourceName,
  urls,
  forceSync = false
) {
  //1. Start Kendra Crawling
  try {
    var dataSourceResponse = await startKendraSync(
      kendraIndexId,
      dataSourceName,
      forceSync
    );
    var documents = [];
    //2. For each of the urls specified use Puppeteer to get the  page
    for (url of urls) {
      console.log("Retrieving " + url);
      if (
        url
          .split(".")
          .slice(-1)[0]
          .toLowerCase() != "pdf"
      ) {
        var page = await getPage(url);
        if (page == null) {
          console.log("Warning: Could not scrape " + url + " skipping....");
          continue;
        }

        //3. Create the Kendra JSON document
        var document = await createKendraDocument(
          page.Page,
          dataSourceResponse.ExecutionId,
          dataSourceResponse.DataSourceId
        );
      } else {
        console.log("Indexing PDF " + url);
        var document = await createKendraDocumentFromPDF(
          url,
          dataSourceResponse.ExecutionId,
          dataSourceResponse.DataSourceId
        );
      }
      documents.push(document);
      if (page) {
        page.Browser.close();
        page.Browser = null;
        page = null;
      }
    }
    //4. Put the documents into the index and end the sync job
    var putResults = await putDocuments(
      kendraIndexId,
      dataSourceResponse.DataSourceId,
      documents
    );

    console.log("Put document results - " + JSON.stringify(putResults));
    if (page && page.Browser) {
      page.Browser.close();
    }
  } catch (err) {
    console.log(err);
    throw err;
  }
}

// (async function main() {
//   process.env.DEFAULT_SETTINGS_PARAM = "CFN-DefaultQnABotSettings-oV2Ix0eaXC53";
//   process.env.CUSTOM_SETTINGS_PARAM = "CFN-CustomQnABotSettings-xC1d440g02LZ";
//   process.env.DATASOURCE_NAME = "QNABotKendraCrawler-oV2Ix0eaXC53";

//   var status = await getDataSourceIdFromDataSourceName(
//     "c46b5bd5-c1d2-4091-9f89-b9e9c4e7d07a",
//     "QNABotKendraCrawler-oV2Ix0eaXC53"
//   );

//   var results = getTextFromPDF(
//     "https://dlt.ri.gov/emergencyui/covidupdates122720.pdf"
//   );

//   result = await bufferize(
//     "https://dlt.ri.gov/emergencyui/WorkShare%20FAQs%2012.11.20.pdf"
//   );
//   var lines = await readlines(result);
//   var allLines = lines.flat(5);
//   var allText = lines.join("\r\n");
//   console.log(allText);
// })();
