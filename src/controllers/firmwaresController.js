import fs from 'fs';
import path from 'path';
import { query } from '../config/db.js';
import crypto from 'crypto';

export const syncFirmwaresFromDisk = async (req, res) => {
    try {
        const uploadDir = path.join(process.cwd(), 'uploads');
        if (!fs.existsSync(uploadDir)) {
            return res.json({ success: true, message: 'Uploads directory does not exist', restored: [] });
        }

        const restored = [];
        const hwFolders = fs.readdirSync(uploadDir);

        for (const hv of hwFolders) {
            const hvPath = path.join(uploadDir, hv);
            if (!fs.statSync(hvPath).isDirectory()) continue;

            const fwFolders = fs.readdirSync(hvPath);
            for (const fv of fwFolders) {
                const fvPath = path.join(hvPath, fv);
                if (!fs.statSync(fvPath).isDirectory()) continue;

                const files = fs.readdirSync(fvPath);
                for (const file of files) {
                    if (path.extname(file).toLowerCase() === '.bin') {
                        const bin_file_path = `/uploads/${hv}/${fv}/${file}`;
                        const existing = await query(
                            'SELECT id FROM `firmwares` WHERE `bin_file_path` = ?',
                            [bin_file_path]
                        );

                        if (existing.length === 0) {
                            const id = crypto.randomUUID();
                            await query(
                                'INSERT INTO `firmwares` (`id`, `hardware_version`, `firmware_version`, `bin_file_path`) VALUES (?, ?, ?, ?)',
                                [id, hv, fv, bin_file_path]
                            );
                            restored.push({ id, hardware_version: hv, firmware_version: fv, bin_file_path });
                        }
                    }
                }
            }
        }

        res.json({
            success: true,
            message: `Scanned disk and restored ${restored.length} firmware(s)`,
            count: restored.length,
            restored
        });
    } catch (err) {
        console.error('Error syncing firmwares from disk:', err);
        res.status(500).json({ success: false, message: 'Server error syncing firmwares from disk' });
    }
};

export const createFirmware = async (req, res) => {
    try {
        const { hardware_version, firmware_version } = req.body;

        if (!hardware_version || !firmware_version) {
            return res.status(400).json({ success: false, message: 'Hardware version and firmware version are required' });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: '.bin file is required' });
        }

        const hv = req.body.hardware_version || 'unknown_hw';
        const fv = req.body.firmware_version || 'unknown_fw';
        const bin_file_path = `/uploads/${hv}/${fv}/${req.file.filename}`;
        const id = crypto.randomUUID();

        await query(`
      INSERT INTO \`firmwares\` (\`id\`, \`hardware_version\`, \`firmware_version\`, \`bin_file_path\`)
      VALUES (?, ?, ?, ?)
    `, [id, hardware_version, firmware_version, bin_file_path]);

        res.status(201).json({
            success: true,
            message: 'Firmware added successfully',
            data: {
                id,
                hardware_version,
                firmware_version,
                bin_file_path
            }
        });
    } catch (err) {
        console.error('Error creating firmware:', err);
        res.status(500).json({ success: false, message: 'Server error creating firmware' });
    }
};

export const getFirmwares = async (req, res) => {
    try {
        const rows = await query('SELECT * FROM `firmwares` ORDER BY `created_at` DESC');

        const formattedData = rows.map(r => ({
            upload: `${req.protocol}://${req.get('host')}${r.bin_file_path}`,
            hardware_v: r.hardware_version,
            firmware_v: r.firmware_version,
            bin_file: r.bin_file_path.split('/').pop(),
            created_at: r.created_at,
            id: r.id
        }));

        res.json({ success: true, data: formattedData });
    } catch (err) {
        console.error('Error fetching firmwares:', err);
        res.status(500).json({ success: false, message: 'Server error fetching firmwares' });
    }
};

export const getLatestFirmware = async (req, res) => {
    try {
        const rows = await query('SELECT * FROM `firmwares` ORDER BY `created_at` DESC LIMIT 1');

        if (rows.length === 0) {
            // Still returning some error format, but keeping it simple. 
            // Or maybe just status 404 with empty object if they expect pure json.
            return res.status(404).json({ error: 'No firmwares found' });
        }

        const r = rows[0];
        const formattedData = {
            firmwareVersion: r.firmware_version,
            hardwareVersion: r.hardware_version,
            otaUrl: `${req.protocol}://${req.get('host')}${r.bin_file_path}`,
            processOta: 1
        };

        res.json(formattedData);
    } catch (err) {
        console.error('Error fetching latest firmware:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

export const deleteFirmware = async (req, res) => {
    try {
        const { id } = req.params;
        await query('DELETE FROM `firmwares` WHERE `id` = ?', [id]);
        res.json({ success: true, message: 'Firmware deleted successfully' });
    } catch (err) {
        console.error('Error deleting firmware:', err);
        res.status(500).json({ success: false, message: 'Server error deleting firmware' });
    }
};
