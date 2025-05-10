import React, { createContext, useState, useContext, useEffect } from 'react';
import * as SQLite from 'expo-sqlite';
import { Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';

// Create context
export const SQLiteContext = createContext(null);

// Database name
const DATABASE_NAME = 'device_manager.db';

// Create SQLiteProvider
export const SQLiteProvider = ({ children }) => {
  const [db, setDb] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const { userData } = useAuth(); // Get current user data from Auth context

  // Initialize the database
  useEffect(() => {
    const initDatabase = async () => {
      try {
        setIsLoading(true);
        console.log('SQLITE - Initializing database');
        
        // Open the database
        const database = await SQLite.openDatabaseAsync(DATABASE_NAME);
        console.log('SQLITE - Database opened successfully');
        
        // Create tables if they don't exist
        await setupDatabase(database);
        
        setDb(database);
      } catch (err) {
        console.error('SQLITE - Error initializing database:', err);
        setError('Failed to initialize database');
        Alert.alert('Database Error', 'Failed to initialize database');
      } finally {
        setIsLoading(false);
      }
    };

    initDatabase();

    // Cleanup on unmount
    return () => {
      if (db) {
        console.log('SQLITE - Closing database on unmount');
        db.closeAsync();
      }
    };
  }, []);

  // Setup database schema and tables
  const setupDatabase = async (database) => {
    try {
      console.log('SQLITE - Setting up database schema');
      
      // Use a transaction for creating all tables to ensure consistency
      await database.withTransactionAsync(async () => {
        // Create locations table
        await database.execAsync(`
          CREATE TABLE IF NOT EXISTS locations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            address TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
          );
        `);

        // Create devices table
        await database.execAsync(`
          CREATE TABLE IF NOT EXISTS devices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            identifier TEXT NOT NULL UNIQUE,
            device_type TEXT NOT NULL,
            model TEXT,
            serial_number TEXT,
            nfc_id TEXT,
            location_id INTEGER,
            status TEXT DEFAULT 'available',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (location_id) REFERENCES locations (id)
          );
        `);

        // Create device_assignments table
        await database.execAsync(`
          CREATE TABLE IF NOT EXISTS device_assignments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id INTEGER NOT NULL,
            user_id TEXT NOT NULL,
            assigned_date TEXT NOT NULL,
            assigned_time TEXT NOT NULL,
            returned_date TEXT,
            returned_time TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (device_id) REFERENCES devices (id)
          );
        `);

        // Create device_returns table
        await database.execAsync(`
          CREATE TABLE IF NOT EXISTS device_returns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id INTEGER NOT NULL,
            location_id INTEGER NOT NULL,
            returned_date_time TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (device_id) REFERENCES devices (id),
            FOREIGN KEY (location_id) REFERENCES locations (id)
          );
        `);

        // Create reports table for any report data
        await database.execAsync(`
          CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            generated_by TEXT NOT NULL,
            report_data TEXT,
            report_type TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
          );
        `);
      });

      console.log('SQLITE - Database schema setup complete');
    } catch (err) {
      console.error('SQLITE - Error setting up database schema:', err);
      throw new Error('Failed to setup database schema');
    }
  };

  // CRUD operations for Locations
  const locationService = {
    // Create new location
    addLocation: async (locationData) => {
      try {
        console.log('SQLITE - Adding location:', locationData);
        const result = await db.runAsync(
          'INSERT INTO locations (name, address) VALUES (?, ?)',
          locationData.name,
          locationData.address || null
        );
        console.log('SQLITE - Location added, ID:', result.lastInsertRowId);
        return result.lastInsertRowId;
      } catch (err) {
        console.error('SQLITE - Error adding location:', err);
        throw err;
      }
    },

    // Get all locations
    getLocations: async () => {
      try {
        console.log('SQLITE - Getting all locations');
        const locations = await db.getAllAsync('SELECT * FROM locations ORDER BY name');
        console.log('SQLITE - Retrieved locations count:', locations.length);
        return locations;
      } catch (err) {
        console.error('SQLITE - Error getting locations:', err);
        throw err;
      }
    },

    // Get location by ID
    getLocationById: async (id) => {
      try {
        console.log(`SQLITE - Getting location with ID: ${id}`);
        const location = await db.getFirstAsync('SELECT * FROM locations WHERE id = ?', id);
        return location;
      } catch (err) {
        console.error(`SQLITE - Error getting location with ID ${id}:`, err);
        throw err;
      }
    },

    // Update location
    updateLocation: async (id, locationData) => {
      try {
        console.log(`SQLITE - Updating location with ID: ${id}`, locationData);
        await db.runAsync(
          'UPDATE locations SET name = ?, address = ? WHERE id = ?',
          locationData.name,
          locationData.address || null,
          id
        );
        return true;
      } catch (err) {
        console.error(`SQLITE - Error updating location with ID ${id}:`, err);
        throw err;
      }
    },

    // Delete location (admin/owner only)
    deleteLocation: async (id) => {
      try {
        // Check if user is admin or owner
        if (!userData || (userData.role !== 'admin' && userData.role !== 'owner')) {
          console.error('SQLITE - Permission denied: Only admin or owner can delete locations');
          throw new Error('Permission denied: Only admin or owner can delete locations');
        }
        
        console.log(`SQLITE - Deleting location with ID: ${id}`);
        await db.runAsync('DELETE FROM locations WHERE id = ?', id);
        return true;
      } catch (err) {
        console.error(`SQLITE - Error deleting location with ID ${id}:`, err);
        throw err;
      }
    }
  };

  // CRUD operations for Devices
  const deviceService = {
    // Create new device
    addDevice: async (deviceData) => {
      try {
        console.log('SQLITE - Adding device:', deviceData);
        const result = await db.runAsync(
          'INSERT INTO devices (identifier, device_type, model, serial_number, nfc_id, location_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
          deviceData.identifier,
          deviceData.device_type,
          deviceData.model || null,
          deviceData.serial_number || null,
          deviceData.nfc_id || null,
          deviceData.location_id || null,
          deviceData.status || 'available'
        );
        console.log('SQLITE - Device added, ID:', result.lastInsertRowId);
        return result.lastInsertRowId;
      } catch (err) {
        console.error('SQLITE - Error adding device:', err);
        throw err;
      }
    },

    // Get all devices
    getDevices: async () => {
      try {
        console.log('SQLITE - Getting all devices');
        const devices = await db.getAllAsync(`
          SELECT d.*, l.name as location_name 
          FROM devices d
          LEFT JOIN locations l ON d.location_id = l.id
          ORDER BY d.identifier
        `);
        console.log('SQLITE - Retrieved devices count:', devices.length);
        return devices;
      } catch (err) {
        console.error('SQLITE - Error getting devices:', err);
        throw err;
      }
    },

    // Get devices by location
    getDevicesByLocation: async (locationId) => {
      try {
        console.log(`SQLITE - Getting devices for location ID: ${locationId}`);
        const devices = await db.getAllAsync(`
          SELECT d.*, l.name as location_name 
          FROM devices d
          LEFT JOIN locations l ON d.location_id = l.id
          WHERE d.location_id = ? AND d.status = 'available'
          ORDER BY d.identifier
        `, locationId);
        console.log(`SQLITE - Retrieved ${devices.length} devices for location ID: ${locationId}`);
        return devices;
      } catch (err) {
        console.error(`SQLITE - Error getting devices for location ID ${locationId}:`, err);
        throw err;
      }
    },

    // Get device by ID
    getDeviceById: async (id) => {
      try {
        console.log(`SQLITE - Getting device with ID: ${id}`);
        const device = await db.getFirstAsync(`
          SELECT d.*, l.name as location_name 
          FROM devices d
          LEFT JOIN locations l ON d.location_id = l.id
          WHERE d.id = ?
        `, id);
        return device;
      } catch (err) {
        console.error(`SQLITE - Error getting device with ID ${id}:`, err);
        throw err;
      }
    },

    // Get device by NFC ID
    getDeviceByNfcId: async (nfcId) => {
      try {
        console.log(`SQLITE - Getting device with NFC ID: ${nfcId}`);
        const device = await db.getFirstAsync(`
          SELECT d.*, l.name as location_name 
          FROM devices d
          LEFT JOIN locations l ON d.location_id = l.id
          WHERE d.nfc_id = ?
        `, nfcId);
        return device;
      } catch (err) {
        console.error(`SQLITE - Error getting device with NFC ID ${nfcId}:`, err);
        throw err;
      }
    },

    // Update device
    updateDevice: async (id, deviceData) => {
      try {
        console.log(`SQLITE - Updating device with ID: ${id}`, deviceData);
        await db.runAsync(
          `UPDATE devices SET 
            identifier = ?, 
            device_type = ?, 
            model = ?, 
            serial_number = ?, 
            nfc_id = ?, 
            location_id = ?, 
            status = ?
          WHERE id = ?`,
          deviceData.identifier,
          deviceData.device_type,
          deviceData.model || null,
          deviceData.serial_number || null,
          deviceData.nfc_id || null,
          deviceData.location_id || null,
          deviceData.status || 'available',
          id
        );
        return true;
      } catch (err) {
        console.error(`SQLITE - Error updating device with ID ${id}:`, err);
        throw err;
      }
    },

    // Delete device (admin/owner only)
    deleteDevice: async (id) => {
      try {
        // Check if user is admin or owner
        if (!userData || (userData.role !== 'admin' && userData.role !== 'owner')) {
          console.error('SQLITE - Permission denied: Only admin or owner can delete devices');
          throw new Error('Permission denied: Only admin or owner can delete devices');
        }
        
        console.log(`SQLITE - Deleting device with ID: ${id}`);
        await db.runAsync('DELETE FROM devices WHERE id = ?', id);
        return true;
      } catch (err) {
        console.error(`SQLITE - Error deleting device with ID ${id}:`, err);
        throw err;
      }
    },

    // Link NFC tag to device
    linkNfcToDevice: async (deviceId, nfcId) => {
      try {
        console.log(`SQLITE - Linking NFC ID ${nfcId} to device ID: ${deviceId}`);
        await db.runAsync(
          'UPDATE devices SET nfc_id = ? WHERE id = ?',
          nfcId,
          deviceId
        );
        return true;
      } catch (err) {
        console.error(`SQLITE - Error linking NFC ID ${nfcId} to device ID ${deviceId}:`, err);
        throw err;
      }
    }
  };

  // CRUD operations for Device Assignments
  const assignmentService = {
    // Create new device assignment
    assignDevice: async (assignmentData) => {
      try {
        console.log('SQLITE - Assigning device:', assignmentData);
        
        // Start a transaction
        await db.withTransactionAsync(async () => {
          // Create the assignment
          const result = await db.runAsync(
            `INSERT INTO device_assignments 
              (device_id, user_id, assigned_date, assigned_time) 
            VALUES (?, ?, ?, ?)`,
            assignmentData.device_id,
            assignmentData.user_id,
            assignmentData.assigned_date,
            assignmentData.assigned_time
          );
          
          // Update device status to 'assigned'
          await db.runAsync(
            'UPDATE devices SET status = ? WHERE id = ?',
            'assigned',
            assignmentData.device_id
          );
          
          console.log('SQLITE - Device assignment created, ID:', result.lastInsertRowId);
          return result.lastInsertRowId;
        });
      } catch (err) {
        console.error('SQLITE - Error assigning device:', err);
        throw err;
      }
    },

    // Get all assignments
    getAssignments: async () => {
      try {
        console.log('SQLITE - Getting all device assignments');
        const assignments = await db.getAllAsync(`
          SELECT 
            da.*, 
            d.identifier, 
            d.device_type, 
            d.model,
            d.serial_number,
            d.nfc_id,
            l.name as location_name
          FROM device_assignments da
          JOIN devices d ON da.device_id = d.id
          LEFT JOIN locations l ON d.location_id = l.id
          ORDER BY 
            CASE 
              WHEN da.returned_date IS NULL THEN 0 
              ELSE 1 
            END,
            da.assigned_date DESC,
            da.assigned_time DESC
        `);
        console.log('SQLITE - Retrieved assignments count:', assignments.length);
        return assignments;
      } catch (err) {
        console.error('SQLITE - Error getting device assignments:', err);
        throw err;
      }
    },

    // Get active assignments (not returned) for the current user
    getUserAssignments: async (userId) => {
      try {
        console.log(`SQLITE - Getting active assignments for user ID: ${userId}`);
        const assignments = await db.getAllAsync(`
          SELECT 
            da.*, 
            d.id as device_id,
            d.identifier, 
            d.device_type, 
            d.model,
            d.serial_number,
            d.nfc_id,
            l.name as location_name
          FROM device_assignments da
          JOIN devices d ON da.device_id = d.id
          LEFT JOIN locations l ON d.location_id = l.id
          WHERE da.user_id = ? AND da.returned_date IS NULL
          ORDER BY da.assigned_date DESC, da.assigned_time DESC
        `, userId);
        console.log(`SQLITE - Retrieved ${assignments.length} active assignments for user ID: ${userId}`);
        return assignments;
      } catch (err) {
        console.error(`SQLITE - Error getting active assignments for user ID ${userId}:`, err);
        throw err;
      }
    },

    // Get assignment by ID
    getAssignmentById: async (id) => {
      try {
        console.log(`SQLITE - Getting assignment with ID: ${id}`);
        const assignment = await db.getFirstAsync(`
          SELECT 
            da.*, 
            d.identifier, 
            d.device_type, 
            d.model,
            d.serial_number,
            d.nfc_id,
            l.name as location_name
          FROM device_assignments da
          JOIN devices d ON da.device_id = d.id
          LEFT JOIN locations l ON d.location_id = l.id
          WHERE da.id = ?
        `, id);
        return assignment;
      } catch (err) {
        console.error(`SQLITE - Error getting assignment with ID ${id}:`, err);
        throw err;
      }
    },

    // Return device
    returnDevice: async (assignmentId, returnData) => {
      try {
        console.log(`SQLITE - Returning device for assignment ID: ${assignmentId}`, returnData);
        
        // Get the device_id from the assignment
        const assignment = await db.getFirstAsync(
          'SELECT device_id FROM device_assignments WHERE id = ?', 
          assignmentId
        );
        
        if (!assignment) {
          throw new Error(`Assignment with ID ${assignmentId} not found`);
        }
        
        // Start a transaction
        await db.withTransactionAsync(async () => {
          // Update the assignment with return information
          await db.runAsync(
            `UPDATE device_assignments SET 
              returned_date = ?, 
              returned_time = ? 
            WHERE id = ?`,
            returnData.returned_date,
            returnData.returned_time,
            assignmentId
          );
          
          // Update device status back to 'available'
          await db.runAsync(
            'UPDATE devices SET status = ? WHERE id = ?',
            'available',
            assignment.device_id
          );
          
          // If location_id is provided, update the device's location
          if (returnData.location_id) {
            await db.runAsync(
              'UPDATE devices SET location_id = ? WHERE id = ?',
              returnData.location_id,
              assignment.device_id
            );
          }
        });
        
        return true;
      } catch (err) {
        console.error(`SQLITE - Error returning device for assignment ID ${assignmentId}:`, err);
        throw err;
      }
    },

    // Create device return record
    createDeviceReturn: async (returnData) => {
      try {
        console.log('SQLITE - Creating device return record:', returnData);
        const result = await db.runAsync(
          `INSERT INTO device_returns 
            (device_id, location_id, returned_date_time) 
          VALUES (?, ?, ?)`,
          returnData.device_id,
          returnData.location_id,
          returnData.returned_date_time
        );
        console.log('SQLITE - Device return record created, ID:', result.lastInsertRowId);
        return result.lastInsertRowId;
      } catch (err) {
        console.error('SQLITE - Error creating device return record:', err);
        throw err;
      }
    },

    // Get assignment history for a device
    getDeviceAssignmentHistory: async (deviceId) => {
      try {
        console.log(`SQLITE - Getting assignment history for device ID: ${deviceId}`);
        const history = await db.getAllAsync(`
          SELECT 
            da.*,
            dr.location_id as return_location_id,
            l.name as return_location_name
          FROM device_assignments da
          LEFT JOIN device_returns dr ON da.device_id = dr.device_id AND da.returned_date IS NOT NULL
          LEFT JOIN locations l ON dr.location_id = l.id
          WHERE da.device_id = ?
          ORDER BY da.assigned_date DESC, da.assigned_time DESC
        `, deviceId);
        return history;
      } catch (err) {
        console.error(`SQLITE - Error getting assignment history for device ID ${deviceId}:`, err);
        throw err;
      }
    }
  };

  // CRUD operations for Reports
  const reportService = {
    // Create new report
    createReport: async (reportData) => {
      try {
        console.log('SQLITE - Creating report:', reportData);
        const result = await db.runAsync(
          `INSERT INTO reports 
            (title, description, generated_by, report_data, report_type) 
          VALUES (?, ?, ?, ?, ?)`,
          reportData.title,
          reportData.description || null,
          reportData.generated_by,
          reportData.report_data ? JSON.stringify(reportData.report_data) : null,
          reportData.report_type || null
        );
        console.log('SQLITE - Report created, ID:', result.lastInsertRowId);
        return result.lastInsertRowId;
      } catch (err) {
        console.error('SQLITE - Error creating report:', err);
        throw err;
      }
    },

    // Get all reports
    getReports: async () => {
      try {
        console.log('SQLITE - Getting all reports');
        const reports = await db.getAllAsync('SELECT * FROM reports ORDER BY created_at DESC');
        
        // Parse report_data JSON
        reports.forEach(report => {
          if (report.report_data) {
            try {
              report.report_data = JSON.parse(report.report_data);
            } catch (e) {
              console.warn('SQLITE - Error parsing report_data JSON:', e);
            }
          }
        });
        
        console.log('SQLITE - Retrieved reports count:', reports.length);
        return reports;
      } catch (err) {
        console.error('SQLITE - Error getting reports:', err);
        throw err;
      }
    },

    // Get report by ID
    getReportById: async (id) => {
      try {
        console.log(`SQLITE - Getting report with ID: ${id}`);
        const report = await db.getFirstAsync('SELECT * FROM reports WHERE id = ?', id);
        
        // Parse report_data JSON
        if (report && report.report_data) {
          try {
            report.report_data = JSON.parse(report.report_data);
          } catch (e) {
            console.warn('SQLITE - Error parsing report_data JSON:', e);
          }
        }
        
        return report;
      } catch (err) {
        console.error(`SQLITE - Error getting report with ID ${id}:`, err);
        throw err;
      }
    },

    // Delete report (admin/owner only)
    deleteReport: async (id) => {
      try {
        // Check if user is admin or owner
        if (!userData || (userData.role !== 'admin' && userData.role !== 'owner')) {
          console.error('SQLITE - Permission denied: Only admin or owner can delete reports');
          throw new Error('Permission denied: Only admin or owner can delete reports');
        }
        
        console.log(`SQLITE - Deleting report with ID: ${id}`);
        await db.runAsync('DELETE FROM reports WHERE id = ?', id);
        return true;
      } catch (err) {
        console.error(`SQLITE - Error deleting report with ID ${id}:`, err);
        throw err;
      }
    }
  };

  // Function to synchronize local SQLite with remote API data (admin/owner only)
  const syncWithRemoteApi = async (apiDeviceService) => {
    try {
      // Check if user is admin or owner
      if (!userData || (userData.role !== 'admin' && userData.role !== 'owner')) {
        console.error('SQLITE - Permission denied: Only admin or owner can sync with remote API');
        throw new Error('Permission denied: Only admin or owner can sync with remote API');
      }
      
      console.log('SQLITE - Starting sync with remote API');
      setIsLoading(true);
      
      // Sync locations
      const remoteLocations = await apiDeviceService.getLocations();
      console.log(`SQLITE - Retrieved ${remoteLocations.length} locations from API`);
      
      // Sync devices and assignments if needed
      // This would involve more complex logic to handle conflicts
      
      console.log('SQLITE - Sync with remote API completed');
      return true;
    } catch (err) {
      console.error('SQLITE - Error syncing with remote API:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Get all active assignments for the current user
  const fetchUserAssignments = async () => {
    if (!db || !userData) return [];
    
    try {
      const userId = userData.userId;
      console.log(`SQLITE - Fetching active assignments for current user: ${userId}`);
      
      // Get only the current user's active assignments
      const assignments = await assignmentService.getUserAssignments(userId);
      
      console.log(`SQLITE - Found ${assignments.length} active assignments for user ${userId}`);
      return assignments;
    } catch (err) {
      console.error('SQLITE - Error fetching user assignments:', err);
      return [];
    }
  };

  // Helper function to check if a user is an admin or owner
  const isAdminOrOwner = () => {
    return userData && (userData.role === 'admin' || userData.role === 'owner');
  };

  // Provide all services and state through context
  const value = {
    db,
    isLoading,
    error,
    locationService,
    deviceService,
    assignmentService,
    reportService,
    syncWithRemoteApi,
    fetchUserAssignments,
    isAdminOrOwner // Export the helper function
  };

  return (
    <SQLiteContext.Provider value={value}>
      {children}
    </SQLiteContext.Provider>
  );
};

// Custom hook to use the SQLite context
export const useSQLite = () => {
  const context = useContext(SQLiteContext);
  if (!context) {
    throw new Error('useSQLite must be used within a SQLiteProvider');
  }
  return context;
};