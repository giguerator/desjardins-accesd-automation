import re
from playwright.sync_api import Page, expect
from institution import *
from desjardins import *
import json
import sys

if __name__ == "__main__":
    try:
        with open("./account.json", 'r', encoding="utf-8") as configFile:
            inst = desjardins(headless = True)
            inst.loadConfig(json.load(configFile))

    except FileNotFoundError as err:
        sys.exit("Configuration file accounts.json not found.")
    
    try:
        inst.login()
        inst.fetchAcountsInformation()
        
    except:
        print("Unable to fetch information from institution")
        pass
    

