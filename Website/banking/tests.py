import banking_api

if __name__ == "__main__":
    banking_handler = banking_api.banking_api()
    banking_handler.load_config()
    banking_handler.get_accounts()
    banking_handler.removeDuplicateAccounts()