// 📁 backend/services/newsService.js

const AdminUser = require('../models/AdminUser');
const News = require('../models/News'); // ✅ Correct & working
const bcrypt = require('bcryptjs');

/**
 * Service layer for all news and admin user related business logic.
 */
class NewsService {
    /**
     * Creates a new admin user.
     * @param {string} name - User's name.
     * @param {string} email - User's email (must be unique).
     * @param {string} password - User's raw password.
     * @param {string} role - User's role (e.g., 'admin', 'editor').
     * @returns {Promise<AdminUser>} The newly created admin user.
     * @throws {Error} If email already exists or a server error occurs.
     */
    static async createAdminUser(name, email, password, role) {
        const existingUser = await AdminUser.findOne({ email });
        if (existingUser) {
            const error = new Error('Email already exists');
            error.statusCode = 409; // Conflict
            throw error;
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new AdminUser({ name, email, password: hashedPassword, role });
        await newUser.save();
        return newUser;
    }

    /**
     * Adds a new news article.
     * @param {string} title - Title of the news article.
     * @param {string} content - Full content of the news article.
     * @param {string} category - Category of the news (e.g., 'sports', 'politics').
     * @param {string} language - Language of the news (e.g., 'en', 'gu').
     * @returns {Promise<News>} The newly created news article.
     * @throws {Error} If failed to add news.
     */
    static async addNewsArticle(title, content, category, language) {
        const article = new News({ title, content, category, language });
        await article.save();
        return article;
    }

    /**
     * Retrieves dashboard statistics for news.
     * @returns {Promise<object>} Object containing total news, news by category, news by language, and recent news.
     * @throws {Error} If failed to retrieve stats.
     */
    static async getDashboardStats() {
        const total = await News.countDocuments();
        const byCategory = await News.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]);
        const byLanguage = await News.aggregate([{ $group: { _id: '$language', count: { $sum: 1 } } }]);
        const recent = await News.find().sort({ createdAt: -1 }).limit(5);
        return { total, byCategory, byLanguage, recent };
    }

    /**
     * Fetches all news articles.
     * @returns {Promise<News[]>} An array of all news articles, sorted by creation date.
     * @throws {Error} If failed to retrieve news.
     */
    static async getAllNews() {
        return News.find().sort({ createdAt: -1 });
    }

    /**
     * Fetches a single news article by its ID.
     * @param {string} id - The ID of the news article.
     * @returns {Promise<News>} The found news article.
     * @throws {Error} If news not found or a server error occurs.
     */
    static async getNewsById(id) {
        const item = await News.findById(id);
        if (!item) {
            const error = new Error('News not found');
            error.statusCode = 404; // Not Found
            throw error;
        }
        return item;
    }

    /**
     * Updates an existing news article.
     * @param {string} id - The ID of the news article to update.
     * @param {object} updateData - Object containing fields to update (title, content, category, language).
     * @returns {Promise<News>} The updated news article.
     * @throws {Error} If news not found or failed to update.
     */
    static async updateNews(id, updateData) {
        const updated = await News.findByIdAndUpdate(
            id,
            updateData,
            { new: true } // Return the updated document
        );

        if (!updated) {
            const error = new Error('News not found');
            error.statusCode = 404; // Not Found
            throw error;
        }
        return updated;
    }

    /**
     * Deletes a news article by its ID.
     * @param {string} id - The ID of the news article to delete.
     * @returns {Promise<void>}
     * @throws {Error} If failed to delete news.
     */
    static async deleteNews(id) {
        const deleted = await News.findByIdAndDelete(id);
        if (!deleted) {
            const error = new Error('News not found'); // Or could imply already deleted
            error.statusCode = 404;
            throw error;
        }
    }
}

module.exports = NewsService;