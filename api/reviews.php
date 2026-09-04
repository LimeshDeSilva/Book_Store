<?php
/**
 * Book Reviews API Endpoint
 */

require_once __DIR__ . '/../config/db.php';
startSecureSession();

$pdo = getDBConnection();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $bookId = (int)($_GET['bookid'] ?? 0);
    if ($bookId <= 0) {
        sendJsonResponse(['success' => false, 'message' => 'Book ID is required.'], 400);
    }

    $stmt = $pdo->prepare("
        SELECT r.reviewld, r.rate, r.review AS description, r.userid, u.firstName, u.lastName
        FROM Review r
        JOIN Users u ON r.userid = u.userid
        WHERE r.bookid = ?
        ORDER BY r.reviewld DESC
    ");
    $stmt->execute([$bookId]);
    $reviews = $stmt->fetchAll();

    $avgStmt = $pdo->prepare("SELECT COALESCE(AVG(rate), 0) as avgRating, COUNT(*) as totalReviews FROM Review WHERE bookid = ?");
    $avgStmt->execute([$bookId]);
    $stats = $avgStmt->fetch();

    sendJsonResponse([
        'success'      => true,
        'reviews'      => $reviews,
        'avgRating'    => round((float)$stats['avgRating'], 1),
        'totalReviews' => (int)$stats['totalReviews']
    ]);
}

if ($method === 'POST') {
    if (!isset($_SESSION['user']['userid'])) {
        sendJsonResponse(['success' => false, 'message' => 'You must be logged in to submit a review.'], 401);
    }

    $userId = (int)$_SESSION['user']['userid'];
    $rawInput = file_get_contents('php://input');
    $input = json_decode($rawInput, true) ?: $_POST;

    $bookId = (int)($input['bookid'] ?? 0);
    $rate = (int)($input['rate'] ?? 0);
    $description = trim($input['description'] ?? '');

    if ($bookId <= 0) {
        sendJsonResponse(['success' => false, 'message' => 'Valid book ID is required.'], 400);
    }

    if ($rate < 1 || $rate > 5) {
        sendJsonResponse(['success' => false, 'message' => 'Rating must be between 1 and 5 stars.'], 400);
    }

    if (empty($description)) {
        sendJsonResponse(['success' => false, 'message' => 'Review description cannot be empty.'], 400);
    }

    // Verify book exists
    $chkBook = $pdo->prepare("SELECT bookid FROM Book WHERE bookid = ?");
    $chkBook->execute([$bookId]);
    if (!$chkBook->fetch()) {
        sendJsonResponse(['success' => false, 'message' => 'Book not found.'], 404);
    }

    $stmt = $pdo->prepare("INSERT INTO Review (userid, bookid, rate, review) VALUES (?, ?, ?, ?)");
    $stmt->execute([$userId, $bookId, $rate, $description]);
    $reviewId = (int)$pdo->lastInsertId();

    sendJsonResponse([
        'success'  => true,
        'message'  => 'Thank you! Your review has been submitted.',
        'reviewId' => $reviewId
    ]);
}

sendJsonResponse(['success' => false, 'message' => 'Method not allowed.'], 405);
