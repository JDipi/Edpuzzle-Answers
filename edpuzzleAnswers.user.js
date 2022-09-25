// ==UserScript==
// @name         Edpuzzle Answers
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Gives correct Edpuzzle answers and allows you to focus away from the tab
// @supportURL   https://github.com/JDipi/Edpuzzle-Answers/issues
// @author       _John#1218 (JDipi)
// @match        https://edpuzzle.com/assignments/*/watch
// @require      https://code.jquery.com/jquery-3.6.1.min.js
// @icon         https://www.google.com/s2/favicons?sz=64&domain=edpuzzle.com
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// ==/UserScript==

(function () {
  let answers;
  let isInitialized = false;
  let token

  // Set up
  const init = () => {
    isInitialized = true;

    // Asks for user token. Find instructions here: https://github.com/JDipi/Edpuzzle-Answers/blob/main/How%20to%20get%20your%20token.md
    token = prompt("Your old token has expired. Please enter a new one. (check the GitHub for a how-to)")

    // Anti-pause properties
    let attrs = ["hidden", "mozHidden", "msHidden", "webkitHidden"]
    attrs.forEach((el) => {
      Object.defineProperty(document, el, function() {
          value : false
      });
    })

    // Styling for correct and incorrect multiple choice answers
    GM_addStyle(`
    .correct {
      color: green;
    }
  
    .incorrect {
      color: red;
    }
    `);

    // three values are needed to get the answers: classID, assignmentID, and the token
    let classID = $("a[href*=classes]").last().attr("href").split("/").pop();
    // We have to call the Edpuzzle API because the assignmentID only exists there
    GM_xmlhttpRequest({
      method: "GET",
      url: `https://edpuzzle.com/api/v3/assignments/${
        window.location.href.split("/")[4]
      }/attempt`,
      onload: (res) => {
        getAnswers(JSON.parse(res.responseText)["mediaId"], classID);
      },
    });
  };
  
  const getAnswers = (assignmentID, classID) => {
    // Scrapes the answers from unpuzzle.net
    let url = `https://www.unpuzzle.net/answers/${assignmentID}?userToken=${token}&classroomID=${classID}&assignmentID=${assignmentID}`;
    GM_xmlhttpRequest({
      method: "GET",
      url,
      onload: (res) => {
        let answersObj = JSON.parse(
          // using jquery to parse html and find the props from unpuzzle
          $("<div></div>")
            .append(res.responseText)
            .find("script#__NEXT_DATA__")
            .text()
        );
        answers = answersObj.props.pageProps.answers;
        // console.log(answersObj.props.pageProps.answers);
      },
    });
  };

  // puts the "reveal answers" button on each multiple choice question
  const addBtn = () => {
    // will only add a button if none already exist
    if (!$("button#reveal").length) {
      let answerIDs = [];
      $(`<button id="reveal">Reveal Answer</button>`).appendTo(
        $("section[aria-label*=Ques]").parent()
      );
      $("button#reveal").on("click", () => {
        // Edpuzzle uses obfuscated class names, so we gotta get creative with the selector
        let questionPrompt = $("section[aria-label*=Ques]").next().text();
        answers.forEach((el) => {
          // using jquery to parse the text is helpful because it automatically simplifies encoded html strings like "&iquest;Qu&eacute; significa el verbo&nbsp;" and makes it into "¿Qué significa el verbo "
          if ($(el.bodyDisplay).text() == questionPrompt) {
            el.correctChoices.forEach((id) => answerIDs.push(id.choiceID));
          }
        });
        $("ul[aria-label*=List]")
          .children()
          // for each multiple choice answer, if the answer id matches the correct answer id, make it green and click it
          .each((i, el) => {
            if (answerIDs.includes($(el).find("label").attr("for"))) {
              $(el).find("p").toggleClass("correct").trigger("click");
            } else {
              $(el).find("p").toggleClass("incorrect");
            }
          });
      });
    }
  };

  // This checks if the video is paused and if a question is currently on the screen
  let t = setInterval(() => {
    var question = $("section[aria-label*=Ques]");
    // There are no answers for "note" and "open ended" style questions, so ignore those.
    if (question.length && question.text().replace(/[^A-Z]/g,"") === 'MULTIPLECHOICEQUESTION') {
      !isInitialized ? init() : void 0;
      addBtn();
      // Wait for the question to exit the DOM before checking for a new question
      setInterval(() => {
        if (!question.length) {
          setInterval(t, 500);
        }
      }, 500);
    }
  }, 500);
})();
