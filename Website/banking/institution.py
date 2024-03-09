from playwright.sync_api import sync_playwright, expect
from playwright_stealth import stealth_sync
import importlib

class institution():

    def __init__(self, timeout = 5000, headless = True):    
        #Set 2FA prefered mode
        self.twoFAMode = "Question"
        self.websiteURL = "http://www.google.com"
        self.headless = headless
        expect.set_options(timeout = timeout)
        self.userName = "user"
        self.password = "password"
        self.securityQuestions = {}
        self.accounts={}

    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_value, traceback):
        self.context.close()
        self.browser.close()
        self.playwright.stop()

    def __del__(self):
        pass

    def _initialize(self):
        pass

    def __str__(self):
        #format into string of the object
        ret = ""
        return ret
    
    def set2FAMode(self,twoFAMode):
        self.twoFAMode = twoFAMode

    def setWebsiteURL(self,websiteURL):
        self.websiteURL = websiteURL

    def setHeadless(self, headless):
        self.headless=headless

    #Load parameters from JSON
    def loadConfig(self, configDict):
        if "website" in configDict:
            self.websiteURL = configDict["website"]
        
        if "authentication" in configDict:
            if "userCode" in configDict["authentication"]:
                self.userName = configDict["authentication"]["userCode"]

            if "password" in configDict["authentication"]:
                self.password = configDict["authentication"]["password"]
            
            if "securityQuestions" in configDict["authentication"]:
                self.securityQuestions = configDict["authentication"]["securityQuestions"]
    
    #Handle the question to allow cookies or not
    def handleCookiesPrompt(self):
        pass
    
    #Handle the login process
    def login(self):
        self.playwright = sync_playwright().start()
        self.browser = self.playwright.chromium.launch(headless=self.headless)
        self.context = self.browser.new_context(user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", locale = "fr-CA,fr;q=0.9,en;q=0.8")
        
        self.page = self.context.new_page()
        
        #Stealth plugin required to avoid access denied from bank
        stealth_sync(self.page)

        self.page.goto(self.websiteURL)

        self.handleCookiesPrompt()
        self.handleInitialLogin()
        self.handle2FactorAuthentification()

    
    #Handle the login prompt from the website
    def handleInitialLogin(self):
        #Need to overload this function
        pass
    
    #Handle 2FA authentification process
    def handleTwoFactorAuthentification(self):
        #Need to overload this function
        pass
    
    #Fetch account information
    def fetchAcountsInformation(self):
        #Need to overload this function then call this
        return self.accounts
    
    #Handle security question 2FA
    def handleSecurityQuestion(self):
        #Need to overload this function
        pass
    
    #Handle 2FA via text message
    def handle2FATextMsg(self):
        #Need to overload this function
        pass
    
    #Fetch all transactions
    def fetchAccountsTransactions(self):
        #Need to overload this function
        pass

    #Clean logout
    def logout(self):
        #Need to implement this website logout logic in daughter class then call this
        self.context.close()
        self.browser.close()
        self.playwright.stop()