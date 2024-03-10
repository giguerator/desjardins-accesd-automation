# core/urls.py

from django.contrib import admin
from django.urls import path, include

from .admin import admin_statistics_view  # new

urlpatterns = [
    path(   # new
        "admin/statistics/",
        admin.site.admin_view(admin_statistics_view),
        name="admin-statistics"
    ),
    path("admin/", admin.site.urls),
    path("shop/", include("shop.urls")),
]