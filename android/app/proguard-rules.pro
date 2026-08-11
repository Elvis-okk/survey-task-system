# ProGuard规则 - SurveyTask应用
-keepattributes *Annotation*
-keepattributes SourceFile,LineNumberTable
-keep public class * extends java.lang.Exception
-keep class com.survey.task.** { *; }
