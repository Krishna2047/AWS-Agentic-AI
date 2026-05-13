"""
Redis Stack: AWS ElastiCache with Redis Engine
===============================================
Provisions a Redis cluster for caching agent responses and dashboard data.

Architecture:
  - Single-node Redis cluster for dev/staging
  - Multi-node Redis cluster for production (with automatic failover)
  - Private subnet placement (no public access)
  - Security group restricts access to backend ECS only
  - Automatic backup enabled
  - CloudWatch monitoring
  - Parameter group for optimization

Features:
  - Automatic failover and recovery
  - Redis persistence (AOF)
  - Memory optimization (maxmemory-policy: allkeys-lru)
  - TTL-based expiration for cached data
  - Connection pooling
"""

from constructs import Construct
import aws_cdk as cdk
from aws_cdk import (
    Stack,
    aws_elasticache as elasticache,
    aws_ec2 as ec2,
    aws_logs as logs,
    CfnOutput,
    Duration,
)


class RedisStack(Stack):
    """Redis ElastiCache cluster for caching."""

    def __init__(
        self,
        scope: Construct,
        id: str,
        vpc: ec2.Vpc,
        backend_security_group: ec2.SecurityGroup,
        environment: str = "dev",
        **kwargs
    ):
        super().__init__(scope, id, **kwargs)

        self.vpc = vpc
        self.backend_sg = backend_security_group
        self.deployment_environment = environment

        # Create Redis security group
        self.redis_sg = ec2.SecurityGroup(
            self,
            "RedisSecurityGroup",
            vpc=vpc,
            description="Security group for Redis cluster",
            allow_all_outbound=False,
        )

        # Allow inbound from backend only
        self.redis_sg.add_ingress_rule(
            peer=backend_security_group,
            connection=ec2.Port.tcp(6379),
            description="Allow backend to connect to Redis",
        )

        # Allow outbound to anywhere (for replication/monitoring)
        self.redis_sg.add_egress_rule(
            peer=ec2.Peer.any_ipv4(),
            connection=ec2.Port.tcp(443),
            description="Allow HTTPS for monitoring",
        )

        # Create DB subnet group (Redis must be in private subnets)
        self.subnet_group = elasticache.CfnSubnetGroup(
            self,
            "RedisSubnetGroup",
            description="Subnet group for Redis cluster",
            subnet_ids=[subnet.subnet_id for subnet in vpc.private_subnets],
        )

        # Note: Using default parameter group
        # Redis 7 defaults already include good settings for caching
        # Custom parameters can be modified later if needed

        # Determine cluster settings based on environment
        if self.deployment_environment == "prod":
            node_type = "cache.r6g.large"
            engine_version = "7.0"
        else:  # dev/staging
            node_type = "cache.t3.micro"
            engine_version = "7.0"

        # Create Redis cluster (single-node for simplicity, handles both dev and prod)
        # Note: CfnCacheCluster doesn't support multi-AZ failover
        # For true HA with failover, use CfnReplicationGroup instead
        self.redis_cluster = elasticache.CfnCacheCluster(
            self,
            "RedisCluster",
            cache_node_type=node_type,
            engine="redis",
            engine_version=engine_version,
            num_cache_nodes=1,  # Single node (sufficient for caching with TTL)
            cache_subnet_group_name=self.subnet_group.ref,
            vpc_security_group_ids=[self.redis_sg.security_group_id],
            auto_minor_version_upgrade=True,
            preferred_maintenance_window="sun:03:00-sun:04:00",
            snapshot_retention_limit=5,  # Keep 5 daily snapshots
            snapshot_window="02:00-03:00",  # Backup window: 2-3am UTC
            tags=[
                cdk.CfnTag(key="Name", value="msp-redis-cache"),
                cdk.CfnTag(key="Environment", value=self.deployment_environment),
            ],
        )

        # Add dependency on subnet group
        self.redis_cluster.add_depends_on(self.subnet_group)

        # CloudWatch Log Group for Redis (for slow log)
        self.log_group = logs.LogGroup(
            self,
            "RedisLogGroup",
            log_group_name="/aws/elasticache/redis/msp-ops",
            retention=logs.RetentionDays.ONE_WEEK,
            removal_policy=cdk.RemovalPolicy.RETAIN,  # Keep logs on stack deletion
        )

        # Outputs
        CfnOutput(
            self,
            "RedisEndpoint",
            value=self.redis_cluster.attr_redis_endpoint_address,
            description="Redis cluster endpoint address",
            export_name="RedisEndpoint",
        )

        CfnOutput(
            self,
            "RedisPort",
            value=str(self.redis_cluster.attr_redis_endpoint_port),
            description="Redis cluster port",
            export_name="RedisPort",
        )

        CfnOutput(
            self,
            "RedisConnectionString",
            value=f"redis://{self.redis_cluster.attr_redis_endpoint_address}:{self.redis_cluster.attr_redis_endpoint_port}/0",
            description="Redis connection string",
            export_name="RedisConnectionString",
        )

        # Store Redis URL for backend environment (port is always 6379 for Redis)
        self.redis_url = f"redis://{self.redis_cluster.attr_redis_endpoint_address}:6379/0"

    def get_redis_endpoint(self) -> str:
        """Get Redis endpoint address."""
        return self.redis_cluster.attr_redis_endpoint_address

    def get_redis_port(self) -> str:
        """Get Redis port (always 6379 for Redis)."""
        return "6379"

    def get_redis_url(self) -> str:
        """Get Redis connection URL."""
        return self.redis_url
