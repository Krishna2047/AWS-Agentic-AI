"""
AWS Billing Service for fetching cost data with credits breakdown.

Uses AWS Cost and Usage Report (CUR) / Billing data to provide:
- Costs with credits applied (net cost)
- Costs without credits (actual usage)
- Service-level breakdown
- Credit amounts applied
"""

import boto3
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Any, Optional, Tuple
from functools import lru_cache
import json

logger = logging.getLogger(__name__)


class BillingService:
    """Service to fetch and process AWS billing data with credits."""

    def __init__(self):
        self.ce_client = boto3.client('ce', region_name='us-east-1')
        self.sts_client = boto3.client('sts')

    def get_costs_with_credits_breakdown(
        self,
        account_names: Optional[List[str]] = None,
        months: int = 3,
        credits_filter: str = 'all'
    ) -> Dict[str, Any]:
        """
        Get costs with and without credits breakdown.

        Args:
            account_names: List of account names to filter (None = all)
            months: Number of months to retrieve
            credits_filter: 'all', 'without_credits', 'with_credits'

        Returns:
            {
                'total_cost': 5.47,  # Net cost (after credits)
                'total_with_credits': 12.50,  # Before credits
                'applied_credits': -7.03,
                'credits_filter': 'all',
                'period': '2026-03 to 2026-05',
                'services': [
                    {
                        'name': 'S3',
                        'cost_with_credits': 2.10,
                        'cost_without_credits': 3.25,
                        'credits_applied': -1.15,
                        'percentage_of_total': 38.3
                    }
                ],
                'cost_by_category': {...},
                'cost_by_account': {...},
                'monthly_trend': {...}
            }
        """
        try:
            # Get date range
            end_date = datetime.now(timezone.utc).date()
            start_date = end_date - timedelta(days=30*months)

            # Fetch cost data from Cost Explorer
            response = self.ce_client.get_cost_and_usage(
                TimePeriod={
                    'Start': start_date.strftime('%Y-%m-%d'),
                    'End': end_date.strftime('%Y-%m-%d')
                },
                Granularity='MONTHLY',
                Filter={
                    'Dimensions': {
                        'Key': 'PURCHASE_TYPE',
                        'Values': ['On Demand', 'Reserved Instance', 'Spot Instances']
                    }
                } if not account_names else {},
                Metrics=['UnblendedCost', 'UsageQuantity', 'AmortizedCost'],
                GroupBy=[
                    {'Type': 'DIMENSION', 'Key': 'SERVICE'},
                    {'Type': 'DIMENSION', 'Key': 'LINKED_ACCOUNT'},
                ],
                Filter={
                    'And': [
                        {
                            'Dimensions': {
                                'Key': 'LINKED_ACCOUNT',
                                'Values': account_names
                            }
                        }
                    ]
                } if account_names else {}
            )

            # Process results
            result = self._process_billing_response(response, credits_filter)

            logger.info(
                f"[Billing Service] Retrieved costs for {months}m: "
                f"${result['total_cost']:.2f} (with credits), "
                f"${result['total_with_credits']:.2f} (without), "
                f"Credits: ${result['applied_credits']:.2f}"
            )

            return result

        except Exception as e:
            logger.error(f"[Billing Service] Error fetching costs: {e}")
            raise

    def _process_billing_response(
        self,
        response: Dict[str, Any],
        credits_filter: str
    ) -> Dict[str, Any]:
        """
        Process Cost Explorer response and calculate credits breakdown.

        Cost Explorer returns:
        - UnblendedCost: Cost before reserved instance discounts
        - AmortizedCost: Cost after RI discounts (closer to what you pay)
        - The difference represents discounts/credits applied

        Formula:
        - cost_without_credits = UnblendedCost
        - cost_with_credits = AmortizedCost
        - credits_applied = AmortizedCost - UnblendedCost (usually negative)
        """
        services = {}
        categories = {}
        accounts = {}
        monthly_trend = {}

        total_unblended = 0.0
        total_amortized = 0.0
        total_credits = 0.0

        # Parse results
        for result_by_time in response['ResultsByTime']:
            period_start = result_by_time['TimePeriod']['Start']
            month_key = period_start[:7]  # YYYY-MM

            for group in result_by_time['Groups']:
                service_name = group['Keys'][0]
                account_id = group['Keys'][1]

                unblended = float(group['Metrics']['UnblendedCost']['Amount'])
                amortized = float(group['Metrics']['AmortizedCost']['Amount'])
                credits = amortized - unblended  # Usually negative

                total_unblended += unblended
                total_amortized += amortized
                total_credits += credits

                # Service breakdown
                if service_name not in services:
                    services[service_name] = {
                        'cost_without_credits': 0.0,
                        'cost_with_credits': 0.0,
                        'credits_applied': 0.0
                    }

                services[service_name]['cost_without_credits'] += unblended
                services[service_name]['cost_with_credits'] += amortized
                services[service_name]['credits_applied'] += credits

                # Monthly trend
                if month_key not in monthly_trend:
                    monthly_trend[month_key] = 0.0
                monthly_trend[month_key] += amortized

                # Account breakdown
                if account_id not in accounts:
                    accounts[account_id] = 0.0
                accounts[account_id] += amortized

                # Category breakdown (simplified mapping)
                category = self._get_service_category(service_name)
                if category not in categories:
                    categories[category] = 0.0
                categories[category] += amortized

        # Filter based on credits_filter
        if credits_filter == 'without_credits':
            display_cost = total_unblended
            service_costs = {k: v['cost_without_credits'] for k, v in services.items()}
        elif credits_filter == 'with_credits':
            display_cost = total_amortized
            service_costs = {k: v['cost_with_credits'] for k, v in services.items()}
        else:  # 'all'
            display_cost = total_amortized
            service_costs = {k: v['cost_with_credits'] for k, v in services.items()}

        # Build service list
        service_list = [
            {
                'name': service_name,
                'cost_with_credits': round(data['cost_with_credits'], 2),
                'cost_without_credits': round(data['cost_without_credits'], 2),
                'credits_applied': round(data['credits_applied'], 2),
                'percentage_of_total': (data['cost_with_credits'] / total_amortized * 100) if total_amortized > 0 else 0
            }
            for service_name, data in sorted(
                services.items(),
                key=lambda x: x[1]['cost_with_credits'],
                reverse=True
            )
        ]

        return {
            'total_cost': round(display_cost, 2),
            'total_with_credits': round(total_amortized, 2),
            'total_without_credits': round(total_unblended, 2),
            'applied_credits': round(total_credits, 2),
            'credits_filter': credits_filter,
            'period': f"{list(monthly_trend.keys())[0]} to {list(monthly_trend.keys())[-1]}" if monthly_trend else "N/A",
            'services': service_list,
            'cost_by_category': {k: round(v, 2) for k, v in sorted(
                categories.items(),
                key=lambda x: x[1],
                reverse=True
            )},
            'cost_by_account': {k: round(v, 2) for k, v in sorted(
                accounts.items(),
                key=lambda x: x[1],
                reverse=True
            )},
            'monthly_trend': {k: round(v, 2) for k, v in sorted(monthly_trend.items())}
        }

    @staticmethod
    def _get_service_category(service_name: str) -> str:
        """Map AWS service name to category."""
        service_lower = service_name.lower()

        categories = {
            'compute': ['ec2', 'lambda', 'ecs', 'ekt', 'batch', 'elastic beanstalk'],
            'storage': ['s3', 'ebs', 'efs', 'glacier', 'fsx'],
            'database': ['rds', 'dynamodb', 'elasticache', 'redshift', 'neptune'],
            'networking': ['vpc', 'cloudfront', 'route53', 'nat gateway', 'elastic ip'],
            'security': ['kms', 'secrets manager', 'acm', 'waf'],
            'analytics': ['athena', 'emr', 'kinesis', 'opensearch'],
            'machine learning': ['sagemaker', 'rekognition', 'comprehend'],
            'governance': ['cloudtrail', 'config', 'cloudwatch'],
            'integration': ['sns', 'sqs', 'eventbridge'],
            'developer tools': ['codecommit', 'codebuild', 'codedeploy'],
        }

        for category, services in categories.items():
            if any(svc in service_lower for svc in services):
                return category.title()

        return 'Other'


# Singleton instance
_billing_service = None


def get_billing_service() -> BillingService:
    """Get or create billing service singleton."""
    global _billing_service
    if _billing_service is None:
        _billing_service = BillingService()
    return _billing_service
