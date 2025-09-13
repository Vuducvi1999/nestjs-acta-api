#!/usr/bin/env node

/**
 * Database Connection Monitor Script
 *
 * This script helps monitor database connections and diagnose connection issues.
 * Run it to check the current status of your database connections.
 */

const axios = require('axios');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';

async function checkHealth() {
  try {
    console.log('🔍 Checking API health...');

    const healthResponse = await axios.get(`${API_BASE_URL}/health`);
    console.log('✅ API Health Status:', healthResponse.data.status);
    console.log('📊 Database Status:', healthResponse.data.database.status);
    console.log(
      '🔗 Active Connections:',
      healthResponse.data.connections.activeConnections,
    );
    console.log(
      '📈 Max Connections:',
      healthResponse.data.connections.maxConnections,
    );
    console.log(
      '💾 Available Connections:',
      healthResponse.data.connections.availableConnections,
    );

    if (healthResponse.data.database.status === 'unhealthy') {
      console.log('❌ Database Issues:', healthResponse.data.database.error);
    }

    if (
      healthResponse.data.connections.activeConnections >=
      healthResponse.data.connections.maxConnections
    ) {
      console.log('⚠️  WARNING: Maximum connections reached!');
      console.log('💡 Recommendations:');
      console.log('   - Restart the application');
      console.log('   - Check for long-running queries');
      console.log('   - Increase DATABASE_MAX_CONNECTIONS if needed');
    }
  } catch (error) {
    console.error('❌ Failed to check health:', error.message);

    if (error.code === 'ECONNREFUSED') {
      console.log('💡 The API server is not running. Start it with:');
      console.log('   yarn start:dev');
    }
  }
}

async function checkConnections() {
  try {
    console.log('\n🔍 Checking connection details...');

    const connectionsResponse = await axios.get(
      `${API_BASE_URL}/health/connections`,
    );
    console.log('📊 Connection Details:', connectionsResponse.data);
  } catch (error) {
    console.error('❌ Failed to check connections:', error.message);
  }
}

async function main() {
  console.log('🚀 ACTA E-Commerce API - Database Connection Monitor');
  console.log('='.repeat(60));

  await checkHealth();
  await checkConnections();

  console.log('\n' + '='.repeat(60));
  console.log('📝 For more information, check the README.md file');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { checkHealth, checkConnections };
