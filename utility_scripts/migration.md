### On your local computer
brew install git

export $(aws cloudformation describe-stacks --stack-name $OUT_STACK --output text --query 'Stacks[0].Outputs[].join(`=`, [join(`_`, [`CF`, `OUT`, OutputKey]), OutputValue ])')

export $(aws cloudformation describe-stacks --stack-name develop-branch-dev-dev-master-10 --output text --query 'Stacks[0].Outputs[].join(`=`, [join(`_`, [`CF`, `IN`, OutputKey]), OutputValue ])')

sudo yum install
git clone https://github.com/aws-samples/aws-ai-qna-bot.git
cd aws-ai-qna-bot/
git branch kendra_translate
npm install
npm run  config

nano config.json
- Set namespace to blank
- Change devEmail

npm run bootstrap
npm run up

### On CloudShell

export $(aws cloudformation describe-stacks --stack-name develop-branch-dev-dev-master-12 --output text --query 'Stacks[0].Outputs[].join(`=`, [join(`_`, [`CF`, `OUT`, OutputKey]), OutputValue ])')

export $(aws cloudformation describe-stacks --stack-name develop-branch-dev-dev-master-10 --output text --query 'Stacks[0].Outputs[].join(`=`, [join(`_`, [`CF`, `IN`, OutputKey]), OutputValue ])')

mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo "export PATH=~/.npm-global/bin:\$PATH" > ~/.profile
source ~/.profile
npm install -g elasticdump

elasticdump --input=https://$CF_IN_ElasticsearchEndpoint  --output=https://CF_OUT_ElasticsearchEndpoint --type=data --awsChain


### In Kibana

GET /_cat/indices

POST _reindex
{
  "source": {
    "index": "develop-branch-dev-dev-master-10_20210206_020224"
  },
  "dest": {
    "index": "develop-branch-dev-dev-master-12_20210209_230238"
  }
}

### Or from the command line 

aws-es-curl -X  POST  https://$CF_OUT_ElasticsearchEndpoint/_reindex   -d '{"source": {"index": "develop-branch-dev-dev-master-10-metrics_20210206_020224"},"dest": {"index": "develop-branch-dev-dev-master-12-metrics_20210209_230238"}}' --region us-east-1
Unable to access metadata service. EC2 Metadata roleName request returned error
{"took":75,"timed_out":false,"total":6,"updated":6,"created":0,"deleted":0,"batches":1,"version_conflicts":0,"noops":0,"retries":{"bulk":0,"search":0},"throttled_millis":0,"requests_per_second":-1.0,"throttled_until_millis":0,"failures":[]}