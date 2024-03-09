/*
 This script should be on a daily cron that runs everyday late at night (ex.: 10PM)
 This will ensure that the funds for upcoming payments are in the account before the start of the day.
*/

const accountInfo = require('../../account.json');
const puppeteer = require('puppeteer-extra');
const args = require('minimist')(process.argv.slice(2))
const prompt = require("prompt-sync")();
 
// Add stealth plugin and use defaults 
const pluginStealth = require('puppeteer-extra-plugin-stealth') 
const twoFAMode = 'Question'

let verboseMode = typeof args.v != 'undefined';
let extraVerboseMode = typeof args.vv != 'undefined';
let status = 'Just started';
let browser, page;
let accounts = {};
let requiredFunds = {};
puppeteer.use(pluginStealth());

function delay(time) {
    return new Promise(function(resolve) { 
        setTimeout(resolve, time)
    });
 }

(async () => {
//async function mainFo(){
    const browser = await puppeteer.launch({
        args: ['--user-agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"'],
        headless: false,
        });
    page = await browser.newPage();

    //await page.setExtraHTTPHeaders({ DNT: "1" });
    await page.setExtraHTTPHeaders({ 
		//'user-agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36', 
		//'upgrade-insecure-requests': '1', 
		'DNT': '1',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8', 
		'accept-encoding': 'gzip, deflate, br', 
		'accept-language': 'fr-CA,fr;q=0.9,en;q=0.8' 
	}); 
    await page.setRequestInterception(true); 
	page.on('request', async (request) => { 
		if (request.resourceType() == 'image') { 
			await request.abort(); 
		} else { 
			await request.continue(); 
		} 
	}); 
    await page.setViewport({ width: 1400, height: 700 });

    try {
        await page.goto('http://accweb.mouv.desjardins.com/', { waitUntil: "networkidle0", timeout: 30000 });

        //Manage cookies prompt
        await handleCookiesPrompt();

        //get cookies
        const cookiesDesjardins = await page.cookies();
        //verbose(JSON.stringify(cookiesDesjardins));
        await page.setCookie(...cookiesDesjardins);
        // First, log into the user's account
        await login();

        // Make sure that we have the funds available for the upcoming payments
        //await checkForUpcomingPaymentFunds();

        // Use spare money that won't be needed for upcoming payments to pay off the credit card
        //await checkForCreditCardPayment();

        // Move leftover spare money, if any, to the savings account
        //await checkForSavings();

        // If there's more than enough money in savings, automatically transfer some to long term savings
        // Whenever this happens, an email will be sent to my finances manager to inform him of the new deposit
        //await checkForLongTermSavingsTransfer();

    } catch (e) {
        await endWithError('stack' in e ? e.stack : e);
    }

    await browser.close();
})();
//}

async function handleCookiesPrompt() {
    const [acceptCookiesButton] = await page.$x("//button[contains(., 'Tout accepter')]");

    if (acceptCookiesButton) {
        verbose('Requested to set cookie preferences.');
 
        await acceptCookiesButton.click()
    }

    return;
    
}

async function login() {
    await handleInitialLogin();
    
    // If there's a security question, answer it to proceed.
    //await handleSecurityQuestion();
    
    // If 2-factor authentification is requeste, handle it.
    await handle2FactorAuthentification();

    // At this point, we're successfully connected and on the accounts summary page.
    // Gather information about every account
    await fetchAcountsInformation();
}

async function handleInitialLogin() {
    status = 'handleInitialLogin';
    verbose('Starting the login process.');

    // If a connection has been established previously, there might already be a card on file - check to log in with it
    if (await page.$('.carte-memorisee a[role="button"]')) {
        verbose('A memorized card is suggested - selecting it.');

        return await Promise.all([
            page.click('.carte-memorisee a[role="button"]'),
            page.waitForSelector('#champsReponse, input[name="motDePasse"]', { timeout: 30000 }),
        ]);
    } else {
        verbose('The user\'s code is requested: entering it.');

        let userCodeInput = await page.$('input[name="codeUtilisateur"]');
        
        if (!userCodeInput) {
            await endWithError('No user code input on this interface.');
        }

        await userCodeInput.type(accountInfo.authentication.userCode, { delay: 50 });
        delay(1000);
        verbose('Entering the user\'s password...');

        let passwordInput = await page.$('input[name="motDePasse"]');
        
        if (!passwordInput) {
            await endWithError('No password input on this interface.');
        }

        await passwordInput.type(accountInfo.authentication.password, { delay: 50 });
        let test = await page.$('button[type="submit"]');

        if (!test) {
            await endWithError('Submit button issue');
        }

        return await Promise.all([
            passwordInput.press('Enter'),
            page.waitForNavigation(),
        ]);

    }
}

async function handleSecurityQuestion() {
    verbose("Handling security question 2FA");
    status = 'handleSecurityQuestion';

    let buttonOtherMethod = await page.waitForSelector("choix-facteur > form > div > dsd-button:nth-child(2) > div > button");

    await Promise.all([
        buttonOtherMethod.click(),
        page.waitForSelector("input[name='groupeTuileChoixFacteur']", { waitUntil: "networkidle0", timeout: 30000 }),
    ]);

    let radioButtonQuestion = await page.waitForSelector('dsd-select-tile:nth-child(3) > div > div > div > div.dsd-select-tile-trigger-container');
   
    await Promise.all([
        radioButtonQuestion.click(),
    ]);

    let buttonSubmit = await page.waitForSelector("button[type='submit']");

    await Promise.all([
        buttonSubmit.click(),
        page.waitForSelector('label[for="reponseQuestionSecurite"]'),
    ]);

    let securityQuestionWrapper = await page.$('input[name="reponseQuestionSecurite"]');
    if (securityQuestionWrapper) {
        verbose('The answer to security question is requested.');

        let questionWrapper = await page.$('label[for="reponseQuestionSecurite"]');
        //let question = (await (await (await questionWrapper.$('b')).getProperty('textContent')).jsonValue()).trim();
        let question = (await  page.evaluate(el => el.textContent, questionWrapper)).trim();
        let answerInput = await page.$('input[name="reponseQuestionSecurite"]');
        let answer = null;

        if (question in accountInfo.authentication.securityQuestions) {
            answer = accountInfo.authentication.securityQuestions[question];
        }
        
        if (!answer) {
            await endWithError('Unknown security question: ' + question);
        }

        verbose('Ah, this is an easy one! I got this...');
        await answerInput.type(answer, { delay: 50 });

        buttonSubmit = await page.waitForSelector("button[type='submit']");

        return await Promise.all([
            buttonSubmit.click(),
            page.waitForSelector('#produitCompte0', { timeout: 30000 }),
        ]);
    }

    return;
}

async function handle2FATexto() {
    verbose("Handling text message 2FA");
    status = 'handleTextMsg2FA';

    let radio = await page.waitForSelector('div.dsd-fieldset-group-wrapper > div > dsd-select-tile:nth-child(2) > div > div > div > div.dsd-select-tile-text-container > label > span');        
    radio.click();

    let buttonContinuer = await page.waitForSelector('button[type=submit]');

    await Promise.all([
        buttonContinuer.click(),
        page.waitForSelector('input[name=codeSecurite]'),
    ]);

    let securityCode = prompt("Enter security code: ")

    let inputSecurityCode = await page.$('input[name=codeSecurite]');

    if(inputSecurityCode) {
        await inputSecurityCode.type(securityCode, { delay: 50 });
        buttonContinuer= await page.waitForSelector('button[type=submit]');

        return await Promise.all([
            buttonContinuer.click(),
            page.waitForSelector('#produitCompte0', { timeout: 30000 }),
        ]);
    }
    return;
}

async function handle2FactorAuthentification() {
    status = 'handle2FactorAuthentification';

    let twoFactorPrompt = await page.$x("//title[contains(.,'Validation en 2&nbsp;étapes')]");
    
    if (twoFactorPrompt) {
        verbose('Handling 2-factor authentification');
        
        //await page.waitForNavigation({
        //    waitUntil: 'networkidle0',
        //});

        switch(twoFAMode) {
            case 'Texto':
                await handle2FATexto();

            case 'Question':
                await handleSecurityQuestion();

            default:
                break;
        }       
    }

    return;
}

async function fetchAcountsInformation() {
    status = 'fetchAcountsInformation';
    verbose('Login successful!');
    verbose('Fetching the accounts information...');
    let accountNodes = await page.$$('.carte-produit');

    //await page.waitForNavigation({
    //    waitUntil: 'networkidle0',
    //    timeout: 60000,
    //});      
    //delay(1000);
    for (const accountNode of accountNodes) {
        
        await page.waitForSelector('.titre-produit .no', accountNode);
        let name = await getTextContentForSelector('.titre-produit .nom', accountNode);
        //let name = await accountNode.$('.titre-produit .nom').textContent;
        let number = await getTextContentForSelector('.titre-produit .no', accountNode);
        let type = (await (await accountNode.getProperty('className')).jsonValue()).indexOf('financement') != -1 ? 'credit' : 'debit';
        let amount = parseFloat((await getTextContentForSelector('.montant', accountNode)).replace(',', '.').replace(/[^\d.]/g, ''));
        let description = await getTextContentForSelector('.titre-produit > p', accountNode);

        accounts[number] = {
            type: type,
            number: number,
            name: name,
            description: description,
            amount: amount
        };
        verbose(type);
        verbose(name);
        verbose(number);
        verbose(description);
        verbose(amount);
        verbose('\n');
    }

    verbose('Accounts information fetched successfully!');
    verbose(accounts, true);
}

async function checkForUpcomingPaymentFunds() {
    status = 'checkForUpcomingPaymentFunds';
    verbose('Checking to make sure funds are available for upcoming payments...');

    // This updates the requiredFunds object in the global scope
    computeRequiredFundsForNextXDays(7);

    for (const account in requiredFunds) {
        if (typeof accounts[account] == 'undefined') {
            await endWithError(`Account configuration references account "${account}", but there is no such account.`);
        }

        if (accounts[account].amount >= requiredFunds[account]) {
            verbose(`There is enough money in ${account} for the upcoming payments.`, true);
            continue;
        }

        const missingAmount = roundAmount((requiredFunds[account] - accounts[account].amount) * (1 + ('paymentsPaddingPercentage' in accountInfo ? accountInfo.paymentsPaddingPercentage : 0)));
        verbose(`Need an additionnal ${missingAmount}$ in ${account} for the upcoming payments.`);

        const transferSource = findTransferSource(missingAmount, account, requiredFunds);

        if (!transferSource) {
            await endWithError(`There is no available transfer source to prepare for this payment!`);
        }
        verbose(`${transferSource} can serve as a source for this - proceeding.`);

        await transfer(missingAmount, transferSource, account);
    }

    verbose('All set for upcoming payments!');
}

async function checkForCreditCardPayment() {
    status = 'checkForCreditCardPayment';
    verbose('Checking to see if we can pay off the credit card.');

    if (!('creditCardAccount' in accountInfo)) {
        verbose('No credit card on file.');
        return;
    }

    let creditCardAmount = accounts[accountInfo.creditCardAccount].amount;

    if (creditCardAmount > 0) {
        verbose(`There is ${creditCardAmount}$ to pay on the credit card.`);
        const spareMoney = findSpareMoney();

        for (const account in spareMoney) {
            if (spareMoney[account] <= creditCardAmount) {
                verbose(`Using the spare ${spareMoney[account]}$ from ${account} to help pay off the credit card.`);
                await transfer(spareMoney[account], account, accountInfo.creditCardAccount);
                creditCardAmount -= spareMoney[account];
            } else {
                verbose(`Using a spare ${creditCardAmount}$ from ${account} to help pay off the credit card.`);
                await transfer(creditCardAmount, account, accountInfo.creditCardAccount);
                creditCardAmount = 0;
            }

            if (creditCardAmount <= 0) {
                break;
            }
        }
    }

    if (creditCardAmount <= 0) {
        verbose('Credit card is paid off!');
    } else {
        verbose(`Leaving ${roundAmount(creditCardAmount)}$ on the credit card.`);
    }
}

async function checkForSavings() {
    status = 'checkForSavings';
    verbose('Checking to see if we can put money aside in savings.');

    if (!('savingsAccount' in accountInfo)) {
        verbose('No savings account on file.');
        return;
    }

    if (!(accountInfo.savingsAccount in accounts)) {
        await endWithError('The savings account specified in the configuration does not match any account.');
    }

    const spareMoney = findSpareMoney();

    for (const account in spareMoney) {
        verbose(`Moving the spare ${spareMoney[account]}$ from ${account} to savings.`);
        await transfer(spareMoney[account], account, accountInfo.savingsAccount);
    }
}

async function checkForLongTermSavingsTransfer() {
    status = 'checkForLongTermSavingsTransfer';
    verbose('Checking to see if we should send money to long term savings.');

    if (!('savingsAccount' in accountInfo) || !('desiredSavingsMonths' in accountInfo) || !('weeklyIncome' in accountInfo) || !('longTermSavingsIncrement' in accountInfo)) {
        verbose(`Missing savingsAccount, desiredSavingsMonths, weeklyIncome or longTermSavingsIncrement in configuration file.`);
        return;
    }

    if (!(accountInfo.savingsAccount in accounts)) {
        await endWithError('The savings account specified in the configuration does not match any account.');
    }

    const monthlyIncome = (accountInfo.weeklyIncome * 52) / 12;
    const desiredSavingsAmount = monthlyIncome * accountInfo.desiredSavingsMonths;
    const currentSavingsAmount = accounts[accountInfo.savingsAccount].amount;

    if (currentSavingsAmount < desiredSavingsAmount) {
        verbose(`Savings accounts has less than your desired ${accountInfo.desiredSavingsMonths} months of income (${roundAmount(desiredSavingsAmount)}$).`);
    } else {
        verbose(`Congrats! You have more than your desired ${accountInfo.desiredSavingsMonths} months of income (${roundAmount(desiredSavingsAmount)}$) in your savings.`);

        if (currentSavingsAmount - desiredSavingsAmount >= accountInfo.longTermSavingsIncrement) {
            verbose(`You have enough money to make a transfer to long term savings. Proceeding...`);
            verbose(`THIS HAS NOT BEEN IMPLEMENTED YET!`);
        }
    }
}

function computeRequiredFundsForNextXDays(dayCount) {
    verbose(`Calculating required funds for the next ${dayCount} days...`, true);

    let date = new Date();
    requiredFunds = {};

    // Sometimes, automated transfers won't happen on the weekends.
    // Counter that by taking the last two days into account as well for required funds.
    date.setDate(date.getDate() - 2);

    for (let i = 0; i < dayCount + 2; i++) {
        date.setDate(date.getDate() + 1);

        const payments = accountInfo.monthlyPayments[date.getDate().toString()];

        if (typeof payments == 'undefined') {
            continue;
        }

        for (const payment of payments) {
            if (typeof requiredFunds[payment.account] == 'undefined') {
                requiredFunds[payment.account] = 0;
            }

            requiredFunds[payment.account] += payment.amount;
            verbose(`Will need ${payment.amount}$ in ${payment.account} on ${date.toLocaleString('en-CA', { month: 'long' })} ${date.getDate()} for "${payment.description}"`, true);
        }
    }

    return requiredFunds;
}

function findTransferSource(amount, toAccount) {
    let fallback = null;
    let fallbackIsOptimal = false;

    for (const account in accounts) {
        if (account == toAccount || accounts[account].type == 'credit' || accounts[account].amount < amount) {
            continue;
        }

        if (account in requiredFunds && (accounts[account].amount - requiredFunds[account]) < amount) {
            continue;
        }

        // If the transfer would put the account under its desired minimum account, it is still viable, but it's only set as a fallback.
        if (!fallback &&
            account in accountInfo.accounts &&
            'minimumAmount' in accountInfo.accounts[account] &&
            (accounts[account].amount - requiredFunds[account] - amount) < accountInfo.accounts[account].minimumAmount) {
            fallback = account;
            fallbackIsOptimal = false;
        }

        if (account == accountInfo.savingsAccount && (!fallback || !fallbackIsOptimal)) {
            fallback = account;
        } else {
            return account;
        }
    }

    return fallback;
}

function findSpareMoney() {
    let spareMoney = {};

    for (const account in accounts) {
        if (accounts[account].type == 'credit' || ('savingsAccount' in accountInfo && accountInfo.savingsAccount == account)) {
            continue;
        }

        let spareAmount = accounts[account].amount;

        if (account in requiredFunds) {
            spareAmount -= requiredFunds[account] * (1 + ('paymentsPaddingPercentage' in accountInfo ? accountInfo.paymentsPaddingPercentage : 0));
        }

        if (account in accountInfo.accounts && 'minimumAmount' in accountInfo.accounts[account]) {
            spareAmount -= accountInfo.accounts[account].minimumAmount;
        }

        spareAmount = roundAmount(spareAmount, true);

        if (spareAmount > 0) {
            spareMoney[account] = spareAmount;
        }
    }

    return spareMoney;
}

async function transfer(amount, fromAccount, toAccount, secondAttempt = false) {
    status = 'transfer';
    verbose(`Initiating transfer of ${amount}$ from ${fromAccount} to ${toAccount}`);

    // Standardize the amount
    amount = parseFloat(amount.toString().replace(',', '.').replace(/[^\d.-]/, ''));

    // Verify that the amount makes sense
    if (amount <= 0) {
        await endWithError(`Cannot transfer an amount of zero or lower.`);
    }

    // Validate that the "from" account has the necessary funds
    if (amount > accounts[fromAccount].amount) {
        await endWithError(`Account ${fromAccount} does not have the funds to transfer ${amount}$ to ${toAccount}.`);
    }

    // Validate that the "from" account is not a credit account
    if (accounts[fromAccount].type == 'credit') {
        await endWithError(`Account ${fromAccount} is a credit account, and therefore cannot be a source for transfers.`);
    }

    await Promise.all([
        page.evaluate(() => { creerModaleVirementImmediat(); }),
        page.waitForSelector('#modaleIFrame', { timeout: 30000 }),
    ]);

    verbose(`Transfer modal is open`, true);
    verbose(`Looking for the form's iframe...`, true);

    let formIframe = await page.$('#modaleIFrame');
    let frame = await formIframe.contentFrame();

    if (!frame) {
        await endWithError('There is no contentFrame for the transfer modal.');
    }

    await frame.waitForSelector('form[name="OperationImmediateForm"]');
    verbose(`Found the form's iframe.`, true);

    await frame.waitForSelector('form[name="OperationImmediateForm"] table .lif');
    verbose(`The form's iframe is loaded.`, true);

    let form = await frame.$('form[name="OperationImmediateForm"]');
    let accountRows = await form.$$('.lif, .lpf');
    let fromRow = null;
    let toRow = null;

    for (let row of accountRows) {
        let content = await getTextContent(row);

        if (content.indexOf(fromAccount) != -1) {
            if (fromRow) {
                await endWithError('Multiple accounts could be a match for transfer. Ending.');
            }

            fromRow = row;
        }

        if (content.indexOf(toAccount) != -1) {
            if (toRow) {
                await endWithError('Multiple accounts could be a match for transfer. Ending.');
            }

            toRow = row;
        }
    }

    if (!toRow || !fromRow) {
        if (!fromRow) {
            verbose(`Source account row for "${fromAccount}" was not found.`);
        }

        if (!toRow) {
            verbose(`Destination account row for "${toAccount}" was not found.`);
        }

        if (!secondAttempt) {
            verbose(`The transfer could not be completed - attempting the transfer a second time...`);
            await page.reload({ waitUntil: "networkidle0", timeout: 30000 });
            return await transfer(amount, fromAccount, toAccount, true);
        } else {
            await endWithError('One or both of the account for the transfer could not be found. Ending.');
        }
    }

    verbose(`Filling the transfer form...`, true);

    // Set to & from with radio inputs
    await (await fromRow.$('input[name="chRadProv"]')).click();
    verbose(`Selected the source account...`, true);
    await (await toRow.$('input[name="chRadDest"]')).click();
    verbose(`Selected the destination account...`, true);

    // Fill in the amount
    await frame.type('input[name="chMontant"]', amount.toString(), { delay: 50 });
    verbose(`Filled in the amount...`, true);

    // Submit the first form
    await Promise.all([
        (await form.$('input[name="chButSubmit"]')).click(),
        frame.waitForSelector('input[name="chButSubmit"][onclick*="corriger"]', { timeout: 30000 }),
    ]);

    verbose(`Submiting the confirmation form...`, true);

    // Submit the confirmation form
    await Promise.all([
        (await frame.$('input[name="chButSubmit"][onclick*="confirmer"]')).click(),
        frame.waitForSelector('input[name="chButSubmit"][onclick*="debuter"]', { timeout: 30000 }),
    ]);

    verbose(`Transfer successful!`);
    verbose(`Closing the transfer modal...`, true);

    // Update the internal accounts with their new amounts
    accounts[fromAccount].amount -= amount;

    if (accounts[toAccount].type == 'debit') {
        accounts[toAccount].amount += amount;
    } else {
        accounts[toAccount].amount -= amount;
    }

    await Promise.all([
        (await page.$('.btnFermerModale')).click(),
        page.waitForSelector('#produitCompte0', { timeout: 30000 })
    ]);

    // Delaying a bit to avoid possible loading and/or processing issues on AccesD
    return await delay(5000);
}

async function getTextContent(element) {
    if (!element) {
        return '';
    }

    return (await (await element.getProperty('textContent')).jsonValue()).trim();
}

async function getTextContentForSelector(selector, parentElement) {
    let element = await parentElement.$(selector);
    return await getTextContent(element);
}

function verbose(message, extra) {
    extra = typeof extra != 'undefined' ? extra : false;

    if (extra && !extraVerboseMode) {
        return;
    }

    if (verboseMode || extraVerboseMode) {
        console.log(message);
    }
}

function roundAmount(amount, floor) {
    floor = typeof floor != 'undefined' ? floor : false;

    if (floor) {
        return parseFloat(Math.floor(amount * 100) / 100).toFixed(2);
    }

    return parseFloat(Math.round(amount * 100) / 100).toFixed(2);
}

async function delay(time) {
   return new Promise(function(resolve) {
       setTimeout(resolve, time)
   });
}

async function endWithError(message) {
    console.log(JSON.stringify({ success: false, message: (typeof message != 'undefined' ? message : ''), status: status }));
    await browser.close();
    process.exit(1);
}

async function endWithSuccess(message) {
    console.log(JSON.stringify({ success: true, message: typeof message != 'undefined' ? message : '' }));
    await browser.close();
    process.exitCode = 0;
}
