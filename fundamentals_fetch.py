import requests
from bs4 import BeautifulSoup

class StockFundamentalsFetcher:
    def __init__(self, stock_code):
        self.stock_code = stock_code
        self.base_url = f'https://www.screener.in/company/{stock_code}/'

    def fetch_data(self):
        response = requests.get(self.base_url)
        if response.status_code != 200:
            raise Exception(f'Failed to fetch data for {self.stock_code}')

        soup = BeautifulSoup(response.content, 'html.parser')
        fundamentals = self.parse_fundamentals(soup)
        return fundamentals

    def parse_fundamentals(self, soup):
        # Example implementation, parse relevant data as needed
        data = {}
        # Parsing logic goes here
        return data

# Example usage
if __name__ == '__main__':
    stock_code = 'RELIANCE'  # Example stock code
    fetcher = StockFundamentalsFetcher(stock_code)
    fundamentals = fetcher.fetch_data()
    print(fundamentals)