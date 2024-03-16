# shop/models.py

from django.db import models


class Item(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(null=True)
    price = models.FloatField(default=0)

    def __str__(self):
        return f"{self.name} (${self.price})"


class Purchase(models.Model):
    customer_full_name = models.CharField(max_length=64)
    item = models.ForeignKey(to=Item, on_delete=models.CASCADE)
    PAYMENT_METHODS = [
        ("CC", "Credit card"),
        ("DC", "Debit card"),
        ("ET", "Ethereum"),
        ("BC", "Bitcoin"),
    ]
    payment_method = models.CharField(max_length=2, default="CC", choices=PAYMENT_METHODS)
    time = models.DateTimeField(auto_now_add=True)
    successful = models.BooleanField(default=False)

    class Meta:
        ordering = ["-time"]

    def __str__(self):
        return f"{self.customer_full_name}, {self.payment_method} ({self.item.name})"

class Account(models.Model):
    number = models.CharField(max_length = 64)
    institution = models.CharField(max_length = 255)
    description = models.TextField(null=True)
    ACCOUNT_TYPE = ["Crédit", "Débit"]
    type = description = models.CharField(max_length = 6, default="Débit", choices = ACCOUNT_TYPE)

    def __str__(self):
        return f"{self.number} (${self.description}), {self.type}, {self.institution}"

class Account_Balance(models.Model):
    time = models.DateTimeField(auto_now_add=True)
    account = models.ForeignKey(to=Account, on_delete=models.CASCADE)
    balance = models.FloatField(default = 0)

    def __str__(self):
        return f"{self.time}, {self.account.number} ({self.account.description}), {self.balance}"

class Transaction(models.Model):
    time = models.DateTimeField(auto_now_add=True)
    description = models.CharField(max_length=255)
    account = models.ForeignKey(to=Account, on_delete=models.CASCADE)
    amount = models.FloatField(default = 0)

    def __str__(self):
        return f"{self.time}, {self.description}, {self.account.number}, {self.amount}"