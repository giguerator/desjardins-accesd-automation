from playwright.sync_api import sync_playwright

def intercept_response(route, request):
    # Get the response
    response = route.continue_()
    if response:
        # Replace the headers in the response
        
        response_headers = response.headers()
        # Modify headers as needed
        
        response_headers['accept-language'] = 'fr-CA,fr;q=0.9,en;q=0.8'
        response_headers['accept-encoding'] = 'gzip, deflate, br'
        response_headers['accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
        response_headers['DNT'] = '1'

        # Set the modified headers back to the response
        route.fulfill(status=response.status(), headers=response_headers, body=response.body())

with sync_playwright() as p:
    #browser = p.chromium.launch()
    #page = browser.new_page()

    # Intercept responses and replace headers
    #page.route('**/*', lambda route, request: intercept_response(route, request))

    # Navigate to a webpage
    #page.goto('https://example.com')

    # Close the browser
    #browser.close()

    #p.start()
    browser = p.chromium.launch(headless=True)

    page = browser.new_page()
    page.set_extra_http_headers({'DNT': '1',
                            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                            'accept-encoding': 'gzip, deflate, br',
                            'accept-language': 'fr-CA,fr;q=0.9,en;q=0.8'})

    page.route('**/*', lambda route, request: intercept_response(route, request))
    page.goto('http://accweb.mouv.desjardins.com/')
    browser.close()
