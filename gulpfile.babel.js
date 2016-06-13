import gulp from 'gulp';
import eslint from 'gulp-eslint';
import babel from 'gulp-babel';
import runSequence from 'run-sequence';
import webpack from 'webpack-stream';
import sass from 'gulp-sass';

gulp.task('lint', function() {
    return gulp.src('src/js/**/*.js')
        .pipe(eslint())
        .pipe(eslint.format())
        .pipe(eslint.failAfterError('fail'));
});

gulp.task('compile-js', function() {
    return gulp.src(['src/js/**/*.js', 'src/js/**/*.jsx'])
        .pipe(babel())
        .pipe(gulp.dest('dist/temp/js-compiled'));
});

gulp.task('webpack-client-js', function() {
    return gulp.src('dist/temp/js-compiled/client/app.js')
        .pipe(webpack({
            output: { filename: 'app.js' }
        }))
        .pipe(gulp.dest('dist/temp/js-packed/client'));
});

gulp.task('copy-client-js', function() {
    return gulp.src('dist/temp/js-packed/client/**/*.js')
        .pipe(gulp.dest('dist/client/js'));
});

gulp.task('copy-server-js', function() {
    return gulp.src('dist/temp/js-compiled/server/**/*.js')
        .pipe(gulp.dest('dist/server/js'));
});

gulp.task('compile-sass', function() {
    return gulp.src('src/sass/**/*.scss')
        .pipe(sass())
        .pipe(gulp.dest('dist/client/css'));
});

gulp.task('copy-templates', function() {
    return gulp.src('src/templates/**/*')
        .pipe(gulp.dest('dist/templates'));
});

gulp.task('build', function() {
    runSequence(
        'lint',
        'compile-js',
        'webpack-client-js',
        'copy-client-js',
        'copy-server-js',
        'compile-sass',
        'copy-templates'
        );
});

gulp.task('default', ['build']);