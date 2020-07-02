# Desjardins AccèsD Automation

This is a simple Node.js script that uses Puppeteer to automatically handle payments, money transfers and savings via your Desjardins AccesD account.

## Getting started

To get started, clone or download this repository and install the dependencies with `npm install`.

Then, create your own `account.json` file in the root directory, using this repository's `account-template.json` as a template.

Once your account and your payments are configured, set a crontab that will execute this script every day around the end of the day (ex.: 11PM). On a Unix machine, you can type `crontab -e` and add the following entry:
```
* 23 * * * node /home/your-user/your-directory/desjardins-accesd-automation/finance.js > /dev/null 2>&1
```

Once that is completed, you're all done!

## Debugging and verbosity
Although the script doesn't output any logs or messages by default, two levels of verbosity are available. 

Using the `-v` argument when calling the script will display messages about what the script is doing. Using the `-vv` argument will display both the regular messages and more detailed information, which can be useful for logging or debugging purposes.

## Notes

Although there are traces in both the code and the configuration file about transferring money to long-term savings accounts (such as REER, CELI or other funds/investments), this feature has not yet been implemented, and there is no plan for its development in the near future. If you would like to implement this feature, feel free to send me a pull request and I will review and merge it into this repository.
