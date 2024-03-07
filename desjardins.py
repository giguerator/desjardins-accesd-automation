from institution import *
import time
import sys
import re
import json


class desjardins(institution):
    def handleCookiesPrompt(self):
        acceptCookiesButton = self.page.locator("//button[contains(., 'Tout accepter')]")

        if acceptCookiesButton is not None:
            print('Requested to set cookie preferences.')
    
            acceptCookiesButton.click()
        
    def handleInitialLogin(self):
        print("Starting the login process.")

        print('The user\'s code is requested: entering it.')
        
        try:
            self.page.get_by_label("Identifiant").fill(self.userName)           
        except:
            print('No user code input on this interface.')
            return

        print('Entering the user\'s password...')
        
        try: 
            self.page.get_by_label("Mot de passe").fill(self.password)
        except:
            print('No password input on this interface.')
            return

        try:
            self.page.locator('button[type="submit"]').click()  
        except:
            print('Submit button issue')

    def handleSecurityQuestion(self):
        print("Handling security question 2FA")

        try:
            #Select other 2FA method
            self.page.locator("choix-facteur > form > div > dsd-button:nth-child(2) > div > button").click()
        except:
            print("Unable to select security question 2FA!")
            return

        try:
            #Select the security question option
            self.page.get_by_label(re.compile("Questions.+")).click()
        except:
            print("Unable to select security question 2FA radio button.")

        #Submit form
        self.page.locator("button[type='submit']").click()
        try:
            expect(self.page.locator('label[for="reponseQuestionSecurite"]')).to_be_visible()
        except:
            print("Security question field did not appear!")
            return

        print('The answer to security question is requested.')

        #Get question
        question = (self.page.locator('label[for="reponseQuestionSecurite"]').text_content()).strip()
      
        answer = ""

        if question in self.securityQuestions:
            answer = self.securityQuestions[question]

        if answer == "":
            sys.exit('Unknown security question: ' + question)

        print('Ah, this is an easy one! I got this...')
        self.page.locator('input[name="reponseQuestionSecurite"]').fill(answer)
        self.page.locator("button[type='submit']").click()

    def handle2FactorAuthentification(self):        
        print('Handling 2-factor authentification')
            
        if self.twoFAMode == "Texto":
                self.handle2FATexto()

        elif self.twoFAMode == 'Question':
                self.handleSecurityQuestion()

        #Check that the account page was loaded
        expect(self.page.locator('#produitCompte0')).to_be_visible(timeout=20000)
        print('Login successful!')

    def fetchAcountsInformation(self):        
        print('Fetching the accounts information...')
        accountNodes = self.page.locator('.carte-produit')
        
        for accountNode in self.page.locator('.carte-produit').all():
            try: 
                number_type = accountNode.locator('.titre-produit .no').text_content(timeout=500)
            except:
                continue
            number = re.sub(" .+","",number_type).strip()

            description = accountNode.locator('.titre-produit > p').text_content().strip()
            if not number:
                number_name = accountNode.locator('.titre-produit .nom').text_content()
                numbers = re.findall("^[0-9 ][^ ]+ ",number_name)
                try:
                    number = numbers[0].strip()
                except:
                    number = description
                name = re.sub("^[0-9][^ ]+ ?","",number_name).strip()

            else:
                name = accountNode.locator('.titre-produit .nom').text_content()
            
            try: 
                expect(accountNode.locator("../..")).to_have_id(re.compile("produitCompte[0-9]+"), timeout=100)
                type = "débit"
            except:
                try: 
                    expect(accountNode.locator("../..")).to_have_id(re.compile("produitCartesPretsMarges[0-9]+"), timeout=100)
                    type = "crédit"
                except:
                    try: 
                        expect(accountNode.locator("../..")).to_have_id(re.compile("detailEpargnePlacement.+"), timeout=100)
                        type = "débit"
                    except:
                        type = "non disponible"

            self.accounts[number]={}
            self.accounts[number]["type"] = type
            self.accounts[number]["name"] = name + " - " + re.sub("^[^ ]+ ?","",number_type).strip()
            self.accounts[number]["description"] = description
            self.accounts[number]["amount"] = (accountNode.locator('.montant').text_content()).replace(",",".").replace("\xa0","").replace("$","")
            print(number + ": " + json.dumps(self.accounts[number],ensure_ascii=False).encode("utf-8").decode())

        if self.accounts is not None:
            print('Accounts information fetched successfully!')
        else:
            print('No account information found.')