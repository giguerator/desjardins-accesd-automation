import re
from playwright.sync_api import Page, expect
from institution import *
from desjardins import *
import json
import sys
import utilities


class banking_api():
    def __init__(self):  
        self.account_balances={}  
        pass

    def __enter__(self):
        return self
    
    def __exit(self, exc_type, exc_value, traceback):
        pass

    def __del__(self):
        pass

    def _initialize(self):
        pass

    def __str__(self):
        #format into string of the object
        ret = ""
        return ret
    
    def load_config(self, config_file_path = "./account.json"):
        try:
            with open(config_file_path, 'r', encoding="utf-8") as config_file:
                self.config=json.load(config_file)
        except FileNotFoundError as err:
            print("Configuration file accounts.json not found.")
    
    def get_accounts(self, include_transactions=False):
        for account in self.config["institutions"]:
            bank=account["type"]
            print(account["description"])
            inst = utilities.loadClass(bank,bank)
            inst.__init__(headless = True)
            inst.loadConfig(account)
            inst.login()
            self.account_balances[account["description"]] = inst.fetchAcountsInformation()
            #print(self.account_balances)
            if include_transactions:
                #to do fetch transactions
                pass

            inst.logout()

    def removeDuplicateAccounts(self):
        print("Removing duplicate accounts")
        new_accounts={}
        for bank_info_A in self.account_balances:
            new_accounts[bank_info_A]={}
            for account_A_attribute, account_A_value in self.account_balances[bank_info_A].items():
                found = False
                for bank_info_B in new_accounts:
                    if bank_info_A != bank_info_B:
                        for account_B_attribute, account_B_value in new_accounts[bank_info_B].items():
                            found = found | (account_A_attribute == account_B_attribute)

                if found:
                    print(account_A_attribute + " is duplicate")

                else:
                    new_accounts[bank_info_A][account_A_attribute]=self.account_balances[bank_info_A][account_A_attribute]
        self.account_balances = new_accounts
        print(self.account_balances)