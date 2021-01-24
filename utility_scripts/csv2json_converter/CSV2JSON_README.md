AWS QnABot -- CSV file to JSON converter tool
===============================================

To support easier ingestion of your content in CSV format, we created this tool to help with the ingestion of CSV content into QnABot Designer. Please refer to the CSV input file specifications below.
Input File Specifications
You can get started with your CSV file with just a few fields:

- question_identifier -- a unique identifier for each question.
- question_type -- there are 2 types in QnABot (qna and quiz). This tool supports "qna" type.
- question -- question that your users will ask. This field supports input for 1 question. You can use the QnABot Designer to add more.
- answer -- answer applicable for the {question} field.
- markdown_answer (optional) -- answer applicable for the {question} field in markdown format.

Sample file format: (the last line should be a empty line)
```
question_identifier, question_type, question, answer, markdown_answer
q_1, qna, this is question 1 created in csv, this is answer 1 created in csv
q_2, qna, this is question 2 created in csv, this is answer 2 created in csv, this is **answer 2** in markdown created in csv
q_3, qna, this is question 3 created in csv, "this is answer 3 created in csv, having commas"
```


To start the CSV to JSON conversion process, open the {qnabot_csv2json_converter.html} in Firefox or Chrome browser.
Then follow the steps outlined in the web page. 

