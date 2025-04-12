// Test runner for world systems
import { runAllTests } from './TerrainWaterSystemTest';

export class SystemTestRunner {
    constructor(engine) {
        this.engine = engine;
    }

    async runTests() {
        if (!this.engine.systems.world || !this.engine.systems.water) {
            console.error('Required systems not initialized');
            return {
                success: false,
                error: 'World or Water system not initialized'
            };
        }

        try {
            // Run the test suite
            const results = runAllTests(
                this.engine.systems.world,
                this.engine.systems.water
            );

            // Log overall success/failure
            console.log('\nOverall Test Results:');
            console.log('Success:', results.success);
            console.log('Total issues:', 
                results.terrain.issues.length + results.boundary.issues.length);

            return results;
        } catch (error) {
            console.error('Error running tests:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Export a helper to create and run tests
export function createTestRunner(engine) {
    return new SystemTestRunner(engine);
}