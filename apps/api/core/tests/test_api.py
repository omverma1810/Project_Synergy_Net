"""
API integration tests for auth, projects, territories flows.
"""
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from datetime import date
from accounts.models import User
from territories.models import Territory


def create_user(email='test@example.com', password='testpass123'):
    return User.objects.create_user(
        username=email.split('@')[0],
        email=email,
        password=password,
        first_name='Test',
        last_name='User',
        role='PRODUCER',
        is_verified=True,
    )


def create_territory(**kwargs):
    defaults = dict(
        name='Test Territory', country_code='TT', region='Test',
        incentive_type='CASH_REBATE', base_percentage=30,
        status='ACTIVE', effective_date=date(2020, 1, 1),
        currency='USD',
    )
    defaults.update(kwargs)
    return Territory.objects.create(**defaults)


class AuthAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_register_creates_user(self):
        response = self.client.post('/api/auth/register/', {
            'email': 'new@example.com',
            'password': 'strongpass123',
            'first_name': 'New',
            'last_name': 'User',
            'company_name': 'Test Films',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(email='new@example.com').exists())

    def test_login_returns_tokens(self):
        create_user()
        response = self.client.post('/api/auth/login/', {
            'email': 'test@example.com',
            'password': 'testpass123',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

    def test_login_invalid_credentials(self):
        response = self.client.post('/api/auth/login/', {
            'email': 'nobody@example.com',
            'password': 'wrongpassword',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_protected_endpoint_requires_auth(self):
        response = self.client.get('/api/projects/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_authenticated_user_can_access_me(self):
        user = create_user()
        self.client.force_authenticate(user=user)
        response = self.client.get('/api/auth/me/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['email'], user.email)


class ProjectAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = create_user()
        self.client.force_authenticate(user=self.user)

    def test_create_project(self):
        response = self.client.post('/api/projects/', {
            'title': 'My Film',
            'type': 'FEATURE',
            'genre': 'action',
            'currency': 'USD',
            'total_budget': '2000000',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['title'], 'My Film')
        self.assertIn('id', response.data)

    def test_list_projects_only_own(self):
        other_user = create_user('other@example.com')
        other_client = APIClient()
        other_client.force_authenticate(user=other_user)
        other_client.post('/api/projects/', {'title': 'Other Film', 'type': 'FEATURE', 'currency': 'USD', 'total_budget': '1000000'}, format='json')

        self.client.post('/api/projects/', {'title': 'My Film', 'type': 'FEATURE', 'currency': 'USD', 'total_budget': '1000000'}, format='json')

        response = self.client.get('/api/projects/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        projects = response.data if isinstance(response.data, list) else response.data.get('results', [])
        titles = [p['title'] for p in projects]
        self.assertIn('My Film', titles)
        self.assertNotIn('Other Film', titles)

    def test_delete_own_project(self):
        create_resp = self.client.post('/api/projects/', {
            'title': 'To Delete', 'type': 'FEATURE', 'currency': 'USD', 'total_budget': '1000000'
        }, format='json')
        project_id = create_resp.data['id']
        delete_resp = self.client.delete(f'/api/projects/{project_id}/')
        self.assertEqual(delete_resp.status_code, status.HTTP_204_NO_CONTENT)

    def test_project_with_spend_estimates_auto_populates_budget(self):
        response = self.client.post('/api/projects/', {
            'title': 'Spend Film', 'type': 'FEATURE', 'currency': 'USD',
            'total_budget': '500000',
            'spend_estimates': {'Local Crew': 100000, 'Equipment': 50000},
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        project_id = response.data['id']

        detail = self.client.get(f'/api/projects/{project_id}/')
        self.assertGreater(len(detail.data.get('budgets', [])), 0)


class TerritoryAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = create_user()
        self.client.force_authenticate(user=self.user)

    def test_territory_list_public(self):
        create_territory(name='Test SA', country_code='TS')
        public_client = APIClient()
        response = public_client.get('/api/territories/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_territory_list_returns_active_only(self):
        create_territory(name='Active', country_code='AC', status='ACTIVE')
        create_territory(name='Suspended', country_code='SU', status='SUSPENDED')
        response = self.client.get('/api/territories/')
        data = response.data if isinstance(response.data, list) else response.data.get('results', [])
        names = [t['name'] for t in data]
        self.assertIn('Active', names)
        self.assertNotIn('Suspended', names)

    def test_territory_detail(self):
        t = create_territory()
        response = self.client.get(f'/api/territories/{t.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['country_code'], 'TT')

    def test_policy_alerts_require_auth(self):
        no_auth = APIClient()
        response = no_auth.get('/api/territories/alerts/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
