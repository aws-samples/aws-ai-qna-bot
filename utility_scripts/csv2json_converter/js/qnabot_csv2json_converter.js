//AWS QnA Bot -- CSV to JSON converter
//more details on AWS QnA Bot project is available by following: https://www.amazon.com/qnabot
//this javascript file contains functions to create a JSON file according to the JSON schema of QnA Bot


			var QUESTION_IDENTIFIER_INDEX;
			var QUESTION_TYPE_INDEX;
			var QUESTION_INDEX;
			var QUESTION_ANSWER_INDEX; 
			var QUESTION_ANSWER_MARKDOWN; 


			//function to load input CSV file and load into an Array
			function load_csv_file(){
				//get the selected file
				var objfileInputToConvert = document.getElementById("input_file").files[0];

				//create and instantiate a new file reader object
				var objFileReader = new FileReader();
				if (objfileInputToConvert) {
					updateProgress ("<br>File selected");
					//load the contents of the file to display in a textarea html object
					var arrCSVOutput = [];
					var strJSONOutput;
					objFileReader.onload = function(event) {
						//store the file contents in a variable. we will use this for conversion to JSON
						updateProgress ("<br>File loaded");
						var strFileContents = event.target.result;
						arrCSVOutput = strFileContents.csvToArray({fSep:',', trim:true, quot:'"'});	//load the CSV file into an Array
						strJSONOutput = convertToQnABotJSON (arrCSVOutput);	//convert the CSV file to QnABot JSON format
						//document.getElementById("inputTextToSave").value = strJSONOutput;
					}
					objFileReader.onerror = function(event) {
						alert (event.target.error.name);
						return;
					}
					objFileReader.readAsText(objfileInputToConvert, "UTF-8");	//read the file 
				} else {
					updateProgress ("<br>No file selected");
				}
			}


			//function to convert the CSV file input to QnABot JSON format
			function convertToQnABotJSON(arrCSVInput) {
				var strJSONOutput = '{"qna": [{';	//start the JSON structure
				updateProgress ("<br>Number of rows found (including header row): " + arrCSVInput.length);
				updateProgress ("<br>Conversion to JSON in progress...");

				//check if the input csv file has the needed fields. If not, return exception and stop conversion
				if (!checkCSVFileFormat(arrCSVInput[0])) {
					return false;
				}

				for (var intRow = 1; intRow < (arrCSVInput.length); intRow++) {	//iterate through the array object (skip header row)
					if (intRow > 1) {
						strJSONOutput = strJSONOutput + '}, {'; 
					}
	
					for (var intCol = 0; intCol <= arrCSVInput[intRow].length; intCol++){	//iterate through each array column for each row
						if (intCol == QUESTION_IDENTIFIER_INDEX) {
							strJSONOutput = strJSONOutput + create_QnA_qid(arrCSVInput[intRow][intCol]);	//create the QnA qid JSON key
						}
						if (intCol == QUESTION_TYPE_INDEX) {
							strJSONOutput = strJSONOutput + create_QnA_type(arrCSVInput[intRow][intCol]);	//create the QnA type JSON key 
						}
						if (intCol == QUESTION_INDEX) {
							strJSONOutput = strJSONOutput + create_QnA_q(arrCSVInput[intRow][intCol]);		//create the QnA q JSON key
						}
						if (intCol == QUESTION_ANSWER_INDEX) {
							strJSONOutput = strJSONOutput + create_QnA_a(arrCSVInput[intRow][intCol]);		//create the QnA a JSON key
						}
						if (intCol == QUESTION_ANSWER_MARKDOWN && arrCSVInput[intRow][intCol]) {			//create the QnA alt+markdown JSON key
							strJSONOutput = strJSONOutput + create_QnA_alt_markdown(arrCSVInput[intRow][intCol]);
						}
						if (arrCSVInput[intRow][intCol] && intCol < arrCSVInput[intRow].length-1) {		//add a comma if more JSON key pairs are to be added
							strJSONOutput = strJSONOutput + ', '; 
						}
					}
				}
				strJSONOutput = strJSONOutput + '}]}';	//close the JSON structure
				strJSONOutput = strJSONOutput.replace(/""/g, '"');	//replace globally for any occurence of two double-quotes
				try {
					if (JSON.parse(strJSONOutput) && typeof JSON.parse(strJSONOutput) === "object") {
						saveConvertedFile (strJSONOutput);	//create converted file and provide dialog box to save the file
					}
				} catch (e){
					console.log (e);
					updateProgress ("<br><font color='red'>ERROR: Input file does not meet file format specifications. <br> Please check your input file headers and/or remove any end-of-line commas and try again. </font>");
				}
				return (strJSONOutput);
			}


			//function to check if the input csv file meets the file format specifications
			function checkCSVFileFormat(arrFieldHeadersinFile) {
				var blnError = false;
				for (var intFieldHeaderinFileCounter = 0; intFieldHeaderinFileCounter < arrFieldHeadersinFile.length; intFieldHeaderinFileCounter++) {
					if (blnError) {
						break;
					}
					switch (arrFieldHeadersinFile[intFieldHeaderinFileCounter]) {
						case "question_identifier":
							QUESTION_IDENTIFIER_INDEX = intFieldHeaderinFileCounter;
							break;
						case "question_type":
							QUESTION_TYPE_INDEX = intFieldHeaderinFileCounter;
							break;
						case "question":
							QUESTION_INDEX = intFieldHeaderinFileCounter;
							break;
						case "answer":
							QUESTION_ANSWER_INDEX = intFieldHeaderinFileCounter;
							break;
						case "markdown_answer":
							QUESTION_ANSWER_MARKDOWN = intFieldHeaderinFileCounter;
							break;
						default:
							updateProgress ("<br><font color='red'>ERROR: Input file does not meet file format specifications. Please check your input file headers and try again. </font>");
							blnError = true;
					}
				}
				if (blnError) {
					return false;
				} else {
					return true;
				}
			}


			//function to create the JSON file and provide option for user to save the created JSON file
			//this JSON file can then be imported using the AWS QnA Bot designer console
			function saveConvertedFile(strJSONOutput) {
					var textToSaveAsBlob = new Blob([strJSONOutput], {type:"text/json"});
					var textToSaveAsURL = window.URL.createObjectURL(textToSaveAsBlob);
					var fileNameToSaveAs = "qnaCSVtoJSON.json";

					var downloadLink = document.createElement("a");
					downloadLink.download = fileNameToSaveAs;
					downloadLink.innerHTML = "Download File";
					downloadLink.href = textToSaveAsURL;
					downloadLink.style.display = "none";
					document.body.appendChild(downloadLink);
					updateProgress ("<br>Conversion complete. Download/Save file when prompted");

					downloadLink.click();
			}

			//function to create the qid JSON key
			function create_QnA_qid (strInputCSVValue) {
				strOutput = '"qid":' + '"' + strInputCSVValue.trim() + '"';
				return strOutput; 
			}
			

			//function to create the type JSON key
			function create_QnA_type (strInputCSVValue) {
				strOutput = '"type":' + '"' + strInputCSVValue.trim() + '"';
				return strOutput; 
				
			}
			

			//function to create the q JSON key
			function create_QnA_q (strInputCSVValue) {
				strOutput = '"q":[' + '"' + strInputCSVValue.trim() + '"]';
				return strOutput; 
				
			}


			//function to create the a JSON key
			function create_QnA_a (strInputCSVValue) {
				strOutput = '"a":' + '"' + strInputCSVValue.trim() + '"';
				return strOutput; 
				
			}


			//function to create the alt+markdown JSON key
			function create_QnA_alt_markdown (strInputCSVValue) {
				strOutput = '"alt":{"markdown":' + '"' + strInputCSVValue.trim() + '"}';
				return strOutput; 
				
			}


			//function to show progress message
			function updateProgress (strProgressMsg) {
				document.getElementById("divProgress").innerHTML = document.getElementById("divProgress").innerHTML + strProgressMsg;
			}




