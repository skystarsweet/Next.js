import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const newPatient = req.body;
    const filePath = path.join(process.cwd(), 'patients.json');

    fs.readFile(filePath, 'utf8', (err, data) => {
      let patients = [];
      if (!err) {
        patients = JSON.parse(data);
      }
      patients.push(newPatient);

      fs.writeFile(filePath, JSON.stringify(patients, null, 2), (err) => {
        if (err) {
          return res.status(500).json({ message: 'Error writing to database' });
        }
        res.status(200).json({ message: 'Patient added successfully' });
      });
    });
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}
