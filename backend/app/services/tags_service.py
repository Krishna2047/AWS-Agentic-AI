"""
AWS Tags Service - Fetch active tags from AWS accounts.

Retrieves tags that are actually in use on resources, organized by key.
Only returns tags on active resources with at least one associated resource.
"""

import boto3
import logging
from typing import Dict, List, Set, Any, Optional
from functools import lru_cache
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class TagsService:
    """Service to fetch and manage AWS tags."""

    def __init__(self, region: str = 'us-east-1'):
        self.region = region
        self.rtapi = boto3.client('resourcegroupstaggingapi', region_name=region)
        self.ec2 = boto3.client('ec2', region_name=region)
        self.cache_expiry = 3600  # 1 hour cache

    def get_active_tags(
        self,
        tag_keys: Optional[List[str]] = None,
        account_ids: Optional[List[str]] = None
    ) -> Dict[str, List[str]]:
        """
        Get active tags from AWS resources.

        Args:
            tag_keys: Specific tag keys to fetch (e.g., ['Environment', 'Project'])
                     If None, fetches common cost/billing tags
            account_ids: Specific account IDs to search (optional)

        Returns:
            Dict mapping tag keys to list of active values:
            {
                'Environment': ['Production', 'Staging', 'Development'],
                'Project': ['ProjectA', 'ProjectB'],
                'Owner': ['TeamName', 'Engineering']
            }
        """
        # Default tag keys for cost allocation
        if tag_keys is None:
            tag_keys = [
                'Environment',
                'Project',
                'Owner',
                'Environment tag',
                'Project Name tag',
                'Ownership tag',
                'Cost Center',
                'Department',
                'Team'
            ]

        active_tags = {}

        try:
            for tag_key in tag_keys:
                try:
                    values = self._get_tag_values_for_key(tag_key, account_ids)
                    if values:  # Only include if there are actual values
                        active_tags[tag_key] = sorted(list(values))
                        logger.info(f"Found {len(values)} active values for tag '{tag_key}'")
                except Exception as e:
                    logger.warning(f"Error fetching tag values for '{tag_key}': {str(e)}")
                    continue

            return active_tags

        except Exception as e:
            logger.error(f"Error fetching active tags: {str(e)}")
            return {}

    def _get_tag_values_for_key(
        self,
        tag_key: str,
        account_ids: Optional[List[str]] = None
    ) -> Set[str]:
        """
        Get all active values for a specific tag key.

        Uses Resource Groups Tagging API to find all resources with this tag key
        and extracts the unique values.

        Args:
            tag_key: The tag key to search for (e.g., 'Environment')
            account_ids: Specific accounts to search

        Returns:
            Set of unique tag values for this key
        """
        values = set()

        try:
            # Use Resource Groups Tagging API to find resources with this tag
            paginator = self.rtapi.get_paginator('get_resources')

            # Filter by tag key
            filter_dict = {
                'ResourceTypeFilters': [
                    'ec2:instance',
                    'ec2:volume',
                    'ec2:snapshot',
                    's3',
                    'rds:db',
                    'lambda:function',
                    'elasticloadbalancing:loadbalancer',
                    'elasticloadbalancing:targetgroup',
                    'autoscaling:autoScalingGroup',
                    'cloudformation:stack',
                ]
            }

            # Paginate through results
            for page in paginator.paginate(**filter_dict):
                for resource in page.get('ResourceTagMappingList', []):
                    # Extract tag value for this key
                    for tag in resource.get('Tags', []):
                        if tag.get('Key', '').lower() == tag_key.lower():
                            tag_value = tag.get('Value', '').strip()
                            if tag_value:  # Only add non-empty values
                                values.add(tag_value)

            return values

        except Exception as e:
            logger.warning(f"Error querying tag key '{tag_key}': {str(e)}")
            return set()

    def get_common_tag_keys(self) -> List[str]:
        """
        Get common tag keys used in the account.

        Returns:
            List of frequently used tag keys
        """
        try:
            # Get tag keys using Resource Groups Tagging API
            response = self.rtapi.get_tag_keys()
            tag_keys = response.get('TagKeys', [])

            # Filter for relevant tags (exclude system tags)
            system_prefixes = ('aws:', 'cloudformation:', 'rds:', 'elasticbeanstalk:', 'ec2:')
            relevant_tags = [
                tag for tag in tag_keys
                if not any(tag.lower().startswith(prefix) for prefix in system_prefixes)
            ]

            return sorted(relevant_tags)[:20]  # Return top 20 tags

        except Exception as e:
            logger.error(f"Error fetching tag keys: {str(e)}")
            return []

    def get_tag_values(self, tag_key: str) -> List[str]:
        """
        Get all values for a specific tag key.

        Args:
            tag_key: The tag key to query

        Returns:
            List of unique tag values
        """
        try:
            response = self.rtapi.get_tag_values(Key=tag_key)
            values = response.get('TagValues', [])
            return sorted(values)

        except Exception as e:
            logger.error(f"Error fetching tag values for '{tag_key}': {str(e)}")
            return []

    def get_cost_allocation_tags(self) -> Dict[str, List[str]]:
        """
        Get tags specifically marked as cost allocation tags.

        Cost allocation tags are tags that AWS uses for billing reports.

        Returns:
            Dict of cost allocation tag keys and their values
        """
        try:
            response = self.ec2.describe_tags(
                Filters=[
                    {
                        'Name': 'resource-type',
                        'Values': ['instance', 'volume', 'snapshot']
                    }
                ]
            )

            cost_tags = {}

            for tag in response.get('Tags', []):
                key = tag.get('Key', '')
                value = tag.get('Value', '')

                # Skip system tags
                if key.startswith('aws:'):
                    continue

                if value and key not in cost_tags:
                    cost_tags[key] = []

                if value and value not in cost_tags[key]:
                    cost_tags[key].append(value)

            # Sort values for each key
            for key in cost_tags:
                cost_tags[key] = sorted(cost_tags[key])

            return cost_tags

        except Exception as e:
            logger.error(f"Error fetching cost allocation tags: {str(e)}")
            return {}

    def validate_tag_value(self, tag_key: str, tag_value: str) -> bool:
        """
        Check if a tag value actually exists for a given key.

        Args:
            tag_key: The tag key
            tag_value: The tag value to validate

        Returns:
            True if the tag value exists, False otherwise
        """
        try:
            values = self.get_tag_values(tag_key)
            return tag_value in values

        except Exception as e:
            logger.warning(f"Error validating tag: {str(e)}")
            return False


# Singleton instance
_tags_service: Optional[TagsService] = None


def get_tags_service(region: str = 'us-east-1') -> TagsService:
    """Get or create tags service singleton."""
    global _tags_service
    if _tags_service is None:
        _tags_service = TagsService(region=region)
    return _tags_service
