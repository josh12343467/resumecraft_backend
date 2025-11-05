require('dotenv').config(); // --- 1. LOAD .env FILE (MUST BE FIRST)

console.log('My DATABASE_URL is:', process.env.DATABASE_URL); // For testing

// --- 2. IMPORT YOUR TOOLS ---
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const puppeteer = require('puppeteer'); // <-- MOVED IMPORT
const fs = require('fs');               // <-- MOVED IMPORT
const cors = require('cors');


// --- CORS Configuration ---
const allowedOrigins = [
  'http://localhost:5173',                      // For your local testing
  'https://jb-resume-generator.vercel.app'     // <-- ADD YOUR REAL VERCEL URL HERE
  // Make sure to replace the Vercel URL with the one Vercel gave you!
];

const corsOptions = {
    origin: function (origin, callback) {
      // Check if the incoming origin is in our allowed list
      if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
        // !origin allows requests with no origin (like Postman)
        callback(null, true);
      } else {
        callback(new Error('This origin is not allowed by CORS'));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    optionsSuccessStatus: 204
};

// --- 3. CREATE INSTANCES OF YOUR TOOLS ---
const app = express();
const prisma = new PrismaClient();

// --- 4. MIDDLEWARE (Setup) ---
app.use(express.json()); // Allow server to read JSON
app.use(cors(corsOptions));        // Allow cross-origin requests  

// --- AUTHENTICATION MIDDLEWARE (Our "ID Checker") ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) {
    return res.status(401).json({ error: 'No token provided.' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token is not valid.' });
    }
    req.user = user;
    next();
  });
};
// --- END OF MIDDLEWARE ---

// --- 5. YOUR API ENDPOINTS (The "Routes") ---

// --- AUTH ENDPOINTS ---
app.post('/api/auth/register', async (req, res) => {
  console.log('Received a request to /api/auth/register');
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await prisma.user.create({
      data: {
        email: email,
        password_hash: hashedPassword,
      },
    });
    console.log('User created successfully!');
    res.status(201).json({ message: 'User created successfully!', user: newUser });
  } catch (error) {
    console.error('Error during registration:', error);
    if (error.code === 'P2002') {
      return res.status(409).json({ // Use 409 Conflict status
        message: 'Registration failed.',
        // This is the message the front-end will use for the alert!
        actualError: 'This email is already registered. Please log in.',
      });
    }

    // Handle all other errors (like database connection issues)
    res.status(500).json({
      message: 'User registration failed due to a server error.',
      actualError: error.message,
    });
  }
});

app.post('/api/auth/login', async (req, res) => {
  console.log('Received a request to /api/auth/login');
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({
      where: { email: email },
    });
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    res.json({ message: 'Login successful!', token: token });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Login failed.' });
  }
});

// --- RESUME "POST" (SAVE) ENDPOINTS ---

app.post('/api/details', authenticateToken, async (req, res) => {
  try {
    const { full_name, phone, linkedin_url, portfolio_url } = req.body;
    const userId = req.user.userId;
    const details = await prisma.personalDetails.upsert({
      where: { userId: userId },
      update: { full_name, phone, linkedin_url, portfolio_url },
      create: { userId, full_name, phone, linkedin_url, portfolio_url },
    });
    res.json({ message: 'Details saved successfully!', details: details });
  } catch (error) {
    console.error('Error saving details:', error);
    res.status(500).json({ error: 'Failed to save details.' });
  }
});

app.post('/api/experience', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { job_title, company, start_date, end_date, description } = req.body;
    const newExperience = await prisma.experience.create({
      data: { job_title, company, start_date, end_date, description, userId },
    });
    res.status(201).json({ message: 'Experience added!', data: newExperience });
  } catch (error) {
    console.error('Error adding experience:', error);
    res.status(500).json({ error: 'Failed to add experience.' });
  }
});

app.post('/api/education', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { school, degree, end_date } = req.body;
    const newEducation = await prisma.education.create({
      data: { school, degree, end_date, userId },
    });
    res.status(201).json({ message: 'Education added!', data: newEducation });
  } catch (error) {
    console.error('Error adding education:', error);
    res.status(500).json({ error: 'Failed to add education.' });
  }
});

app.post('/api/skill', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { skill_name, category } = req.body;
    const newSkill = await prisma.skill.create({
      data: { skill_name, category, userId },
    });
    res.status(201).json({ message: 'Skill added!', data: newSkill });
  } catch (error) {
    console.error('Error adding skill:', error);
    res.status(500).json({ error: 'Failed to add skill.' });
  }
});

app.post('/api/project', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { project_name, description, link } = req.body;
    const newProject = await prisma.project.create({
      data: { project_name, description, link, userId },
    });
    res.status(201).json({ message: 'Project added!', data: newProject });
  } catch (error) {
    console.error('Error adding project:', error);
    res.status(500).json({ error: 'Failed to add project.' });
  }
});

// --- RESUME "GET" (FETCH) ENDPOINTS ---

app.get('/api/resume', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const resumeData = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        personalDetails: true,
        experiences: true,
        education: true,
        skills: true,
        projects: true,
      },
    });
    delete resumeData.password_hash; // Don't send the password!
    res.json({ message: 'Resume data fetched!', data: resumeData });
  } catch (error) {
    console.error('Error fetching resume data:', error);
    res.status(500).json({ error: 'Failed to fetch resume data.' });
  }
});

// --- "GENERATE PDF" ENDPOINT (THE "WOW" FEATURE) ---
// THIS IS THE BLOCK WE MOVED. IT IS NO LONGER NESTED.
app.get('/api/resume/generate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // 1. Fetch all resume data
    const resumeData = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        personalDetails: true,
        experiences: true,
        education: true,
        skills: true,
        projects: true,
      },
    });

    // 2. Read your HTML template file
    let html = fs.readFileSync('template.html', 'utf-8');

    // 3. Replace simple placeholders
    const details = resumeData.personalDetails;
    html = html.replace('{{full_name}}', details?.full_name || 'Your Name');
    html = html.replace('{{email}}', resumeData.email);
    html = html.replace('{{phone}}', details?.phone || 'Your Phone');
    html = html.replace('{{linkedin_url}}', details?.linkedin_url || 'Your LinkedIn');

    // 4. Build the HTML for our lists
    
    // --- Build Experiences HTML ---
    let experiencesHtml = '';
    for (const job of resumeData.experiences) {
      experiencesHtml += `
        <div class="job">
          <h3>${job.job_title} at ${job.company}</h3>
          <p>${job.start_date || ''} - ${job.end_date || 'Present'}</p>
          <p>${job.description || ''}</p>
        </div>
      `;
    }
    html = html.replace('{{experiences}}', experiencesHtml);

    // --- Build Projects HTML ---
    let projectsHtml = '';
    for (const project of resumeData.projects) {
      projectsHtml += `
        <div class="project">
          <h3>${project.project_name}</h3>
          <p>${project.description || ''} (${project.link || ''})</p>
        </div>
      `;
    }
    html = html.replace('{{projects}}', projectsHtml);

    // --- Build Education HTML ---
    let educationHtml = '';
    for (const edu of resumeData.education) {
      educationHtml += `<div class="edu"><h3>${edu.degree} from ${edu.school}</h3></div>`;
    }
    html = html.replace('{{education}}', educationHtml);

    // --- Build Skills HTML ---
    let skillsHtml = '';
    for (const skill of resumeData.skills) {
      skillsHtml += `<div class="skill">${skill.skill_name}</div>`;
    }
    html = html.replace('{{skills}}', skillsHtml);

    // 5. Launch the "invisible browser" and create the PDF
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
    });

    await browser.close();

    // 6. Send the PDF back to the user
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': pdf.length,
    });
    res.send(pdf);

  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF.' });
  }
});

// --- NEW "DELETE" ENDPOINT ---
// We use app.delete() and a "URL parameter" (:id) to get the item's ID
app.delete('/api/experience/:id', authenticateToken, async (req, res) => {
  try {
    // 1. Get the user's ID from their token
    const userId = req.user.userId;
    
    // 2. Get the experience ID from the URL
    // We use parseInt() to make sure it's a number
    const experienceId = parseInt(req.params.id);

    // 3. This is a CRITICAL security check.
    // We use "deleteMany" to make sure the user can ONLY delete
    // an item that BOTH matches the ID *and* belongs to them.
    const deleteResult = await prisma.experience.deleteMany({
      where: {
        id: experienceId,
        userId: userId, // <-- This ensures you can't delete someone else's data
      },
    });

    // 4. Check if anything was actually deleted
    if (deleteResult.count === 0) {
      return res.status(404).json({ error: 'Experience not found or you do not have permission to delete it.' });
    }

    res.json({ message: 'Experience deleted successfully!' });

  } catch (error) {
    console.error('Error deleting experience:', error);
    res.status(500).json({ error: 'Failed to delete experience.' });
  }
});

// --- NEW "DELETE EDUCATION" ENDPOINT ---
app.delete('/api/education/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const educationId = parseInt(req.params.id);

    const deleteResult = await prisma.education.deleteMany({
      where: {
        id: educationId,
        userId: userId, // Security check
      },
    });

    if (deleteResult.count === 0) {
      return res.status(404).json({ error: 'Education not found or you do not have permission.' });
    }
    res.json({ message: 'Education deleted successfully!' });
  } catch (error) {
    console.error('Error deleting education:', error);
    res.status(500).json({ error: 'Failed to delete education.' });
  }
});

// --- NEW "DELETE PROJECT" ENDPOINT ---
app.delete('/api/project/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const projectId = parseInt(req.params.id);

    const deleteResult = await prisma.project.deleteMany({
      where: {
        id: projectId,
        userId: userId, // Security check
      },
    });

    if (deleteResult.count === 0) {
      return res.status(404).json({ error: 'Project not found or you do not have permission.' });
    }
    res.json({ message: 'Project deleted successfully!' });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project.' });
  }
});

// --- NEW "DELETE SKILL" ENDPOINT ---
app.delete('/api/skill/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const skillId = parseInt(req.params.id);

    const deleteResult = await prisma.skill.deleteMany({
      where: {
        id: skillId,
        userId: userId, // Security check
      },
    });

    if (deleteResult.count === 0) {
      return res.status(404).json({ error: 'Skill not found or you do not have permission.' });
    }
    res.json({ message: 'Skill deleted successfully!' });
  } catch (error) {
    console.error('Error deleting skill:', error);
    res.status(500).json({ error: 'Failed to delete skill.' });
  }
});

// Render will provide its own port. We must use it.
// process.env.PORT is Render's port. 3000 is our backup for local.
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});