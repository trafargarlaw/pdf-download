const puppeteerS = require("puppeteer-extra");
const fs = require("fs");
const path = require("path");
const { DownloaderHelper } = require("node-downloader-helper");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteerS.use(StealthPlugin());

const downloadPath = path.resolve("./downloads");

// read urls file
const urls = fs.readFileSync("./urls.txt", "utf8").split("\n");

const chromeOptions = {
  ignoreHTTPSErrors: true,
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",

  headless: true,
  slowMo: 10,
  args: [`--window-size=676,768`],
  setDownloadBehavior: {
    behavior: "allow",
    downloadPath: downloadPath,
  },
};

puppeteerS.launch(chromeOptions).then(async (browser) => {
  for (const i in urls) {
    const page = await browser.newPage();

    await page.goto(urls[i]);
    console.log("page loaded", urls[i]);

    await page.waitForSelector("#download-button-link");
    const bookTitle = await page.evaluate(
      () => document.querySelector(".ebook-title").innerText
    );
    console.log("got book title", bookTitle);
    const formattedBookTitle = bookTitle.replace(/[^a-zA-Z0-9]/g, "_");
    console.log("formated the book title", formattedBookTitle);
    await page.click("#download-button-link");
    const pages = await browser.pages();
    const page1 = pages[1];
    //focus on the download page
    await page1.bringToFront();

    await page.waitForSelector(
      "#alternatives > div.text-center, body > div.dialog > div.dialog-main > div.dialog-left > center > h5",
      {
        timeout: 0,
      }
    );

    const downloadLink = await page.evaluate(() => {
      if (
        document.querySelector(
          "body > div.dialog > div.dialog-main > div.dialog-left > center > h5"
        )
      ) {
        return false;
      } else if (
        document.querySelector("#alternatives > div.text-center > a")
      ) {
        return document.querySelector("#alternatives > div.text-center > a")
          .href;
      } else {
        return document.querySelector(
          "#alternatives > div.text-center > div > a"
        ).href;
      }
    });
    console.log("download link", downloadLink);

    if (downloadLink) {
      const dl = new DownloaderHelper(
        downloadLink.replace("epub", "pdf"),
        downloadPath,
        {
          fileName: formattedBookTitle + ".pdf",
          retry: { maxRetries: 5, delay: 1000 },
        }
      );
      dl.on("end", () => console.log("Download Completed"));
      dl.on("retry", () => console.log("Request failed retrying..."));
      // on error write the url[i] and downloadLink to error.txt file
      dl.on("error", (err) => {
        fs.appendFileSync(
          "./error.txt",
          urls[i] + " " + downloadLink + " " + err + "\r\n"
        );
      });

      // try to start 3 times
      dl.start();

      console.log("I clicked download");
      // wait for download to complete and close all the pages but page 0c
      const allPages = await browser.pages();

      for (let i = 1; i < allPages.length; i++) {
        await allPages[i].close();
      }
      console.log("I closed pages");
    } else {
      console.log("no download link");
      fs.appendFileSync("./error.txt", urls[i] + " no download link \n");
      const allPages = await browser.pages();

      for (let i = 1; i < allPages.length; i++) {
        await allPages[i].close();
      }
      console.log("I closed pages");
    }
  }
  console.log("Downloads completed");
  await browser.close();
});
