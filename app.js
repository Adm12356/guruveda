require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const fileUpload = require('express-fileupload');
const pages = require('./routes/pages');
const admin = require('./routes/admin');
const student = require('./routes/student');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Edit these once - they appear in the header, footer and contact page.
app.locals.site = {
  name: 'Guruveda Abacus Academy',
  tagline: 'Mental maths, taught the abacus way',
  phone: '+91 88880 00303',
  email: 'gvacademy041@gmail.com',
  address: '12, Example Road, Andheri West, Mumbai 400058',
  hours: 'Mon-Sat, 4:00 PM - 8:00 PM'
};

app.locals.fmt = require('./lib/format');

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(fileUpload({ limits: { fileSize: 5 * 1024 * 1024 }, abortOnLimit: true })); // ready for a future admin panel
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-only-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 2 }
}));

// One-time flash message (used after the contact form)
app.use((req, res, next) => {
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  res.locals.currentPath = req.path;
  next();
});

app.use('/admin', admin);
app.use('/student', student);
app.use('/', pages);

app.use((req, res) => {
  res.status(404).render('error', { title: 'Page not found', heading: 'Page not found', message: 'The page you are looking for does not exist.' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', { title: 'Something went wrong', heading: 'Something went wrong', message: 'Please try again in a moment.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Running on http://localhost:${PORT}`));
