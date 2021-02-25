Amazon Kendra is an intelligent search service powered by machine learning.

QnABot can use Kendra to answer questions based on indexed documents when an exact match cannot be found in ElasticSearch.  
But, what if you do not have any documents to index? You do have a website....

QnABot can now index your website with Kendra and answer questions based on what it has found.

[](./settings.png)

1. Go to settings and enable the indexer by setting ENABLE_WEB_INDEXER to true
1. Tell QnABot which pages to index by specifying a comma separated list of addreses in KENDRA_INDEXER_URLS
1. The indexer can be configured to run on a schedule by setting the KENDRA_INDEXER_SCHEDULER
   It supports standard [CloudWatch Events rate syntax]()